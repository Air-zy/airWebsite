const envDecrypt = require('../envDecrypt.js');
const postgres = require('postgres');

function tryDecrypt(envVal) {
  return envDecrypt(process.env.airKey, envVal);
}

const DB_HOST = tryDecrypt(process.env.DATABASE_HOST);
const DB_USER = tryDecrypt(process.env.DATABASE_USER);
const DB_PASSWORD = tryDecrypt(process.env.DATABASE_PASSWORD);
const DB_NAME = tryDecrypt(process.env.DATABASE_NAME);

const MAX_CONNS = 5;
const sql = postgres({
  host: DB_HOST,
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,

  max: MAX_CONNS,
  idle_timeout: 10_000,
  connect_timeout: 30_000,
  ssl: 'require'
});

// literally just a db ping
async function healthCheck() {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (err) {
    console.error('[POSTGRES_DB] healthCheck failed:', err);
    return false;
  }
}

//
async function ensureTables() {
  try {
    // players table
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        player_id BIGINT PRIMARY KEY
      )
    `;

    // fights table
    await sql`
      CREATE TABLE IF NOT EXISTS fights (
        fight_id BIGSERIAL PRIMARY KEY,
        victim_id BIGINT REFERENCES players(player_id),
        raw_snapshot JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // fight_contributions table
    await sql`
      CREATE TABLE IF NOT EXISTS fight_contributions (
        fight_id BIGINT REFERENCES fights(fight_id),
        killer_id BIGINT REFERENCES players(player_id),
        enemy_focus_percent INT,
        my_focus_percent INT,
        last_hit_ms INT,
        time_since_fight_start_ms INT,
        enemy_dmg_me INT,
        PRIMARY KEY (fight_id, killer_id)
      )
    `;

    await sql`
      ALTER TABLE fight_contributions
      ADD COLUMN IF NOT EXISTS enemy_dmg_me INT DEFAULT 0
    `;

    console.log('[POSTGRES_DB] Tables ensured');
  } catch (err) {
    console.error('[POSTGRES_DB] Error ensuring tables:', err);
    throw err;
  }
}

//

async function getAllFights() {
  try {
    const fights = await sql`
      SELECT * FROM fights
      ORDER BY created_at DESC
    `;
    return fights;
  } catch (err) {
    console.error('[getAllFights] error:', err);
    throw err;
  }
}

async function getContributionsByFightId(fightId) {
  try {
    const id = BigInt(fightId);

    const contributions = await sql`
      SELECT *
      FROM fight_contributions
      WHERE fight_id = ${id}
      ORDER BY killer_id ASC
    `;

    return contributions; // array of contributions, or [] if none
  } catch (err) {
    console.error('[getContributionsByFightId] error:', err);
    throw err;
  }
}



/*
must be authorized to use this!! silly

logFight(victimId, killers, raw)
 - victimId: number (roblox player id)
 - killers: array of { key, EnemyFocusAgainstMe, MyFocusAgainstEnemy, lastHitMe, timeSinceFightStarted }
 - raw: optional raw object to store in fights.raw_snapshot
 returns inserted fight_id on success.
*/
async function logFight(preVictimId, killers = [], raw = null) {
    if (!preVictimId) throw new Error('victimId required');
    return sql.begin(async (tx) => {
        const victimId = BigInt(preVictimId);

        // idempotent ensure players exist
        await tx`
            INSERT INTO players (player_id)
            VALUES (${victimId})
            ON CONFLICT (player_id) DO NOTHING
        `;
    
        for (const k of killers) {
            const killerKey = BigInt(k.key)
            await tx`
                INSERT INTO players (player_id)
                VALUES (${killerKey})
                ON CONFLICT (player_id) DO NOTHING
            `;
        }
    
        // insert fight
        const [fight] = await tx`
            INSERT INTO fights (victim_id, raw_snapshot)
            VALUES (${victimId}, ${raw})
            RETURNING fight_id
        `;
    
        // insert contributions
        for (const k of killers) {
            const enemyFocusPercent = Math.round((k.EnemyFocusAgainstMe ?? 0) * 100);
            const myFocusPercent    = Math.round((k.MyFocusAgainstEnemy ?? 0) * 100);
            const lastHitSeconds    = Math.round(k.lastHitMe ?? 0);
            const timeSinceSeconds  = Math.round(k.timeSinceFightStarted ?? 0);
            const killerKey         = BigInt(k.key)
            const enemyDmgToMe      = Math.round(k.enemyDmgToMe ?? 0);
      
            await tx`
              INSERT INTO fight_contributions
                (fight_id, killer_id, enemy_focus_percent, my_focus_percent, last_hit_ms, time_since_fight_start_ms, enemy_dmg_me)
              VALUES
                (${fight.fight_id}, ${killerKey}, ${enemyFocusPercent}, ${myFocusPercent}, ${lastHitSeconds}, ${timeSinceSeconds}, ${enemyDmgToMe})
            `;
        }
    
        return fight.fight_id;
  });
}

module.exports = {
  sql,
  healthCheck,
  logFight,
  ensureTables,

  getAllFights,
  getContributionsByFightId
};
