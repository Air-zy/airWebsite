const { getSQL } = require("./parseSQL.js")
const sql = getSQL(process.env.ROWA_DB);

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
        last_hit INT,
        since_fight_start INT,
        enemy_dmg_me INT,
        me_dmg_enemy INT,
        PRIMARY KEY (fight_id, killer_id)
      )
    `;

    /*await sql`
      ALTER TABLE fight_contributions
      RENAME COLUMN last_hit_ms TO last_hit
    `;
    await sql`
      ALTER TABLE fight_contributions
      RENAME COLUMN time_since_fight_start_ms TO since_fight_start
    `;*/

    await sql`
      ALTER TABLE fight_contributions
      ADD COLUMN IF NOT EXISTS enemy_dmg_me INT DEFAULT 0
    `;

    await sql`
      ALTER TABLE fight_contributions
      ADD COLUMN IF NOT EXISTS me_dmg_enemy INT DEFAULT 100
    `;

    // this was a fix
    await sql`
      SELECT setval(
        pg_get_serial_sequence('fights', 'fight_id'),
        COALESCE((SELECT MAX(fight_id) FROM fights), 0)
      )
    `;

    console.log('[POSTGRES_DB] Tables ensured');
  } catch (err) {
    console.error('[POSTGRES_DB] Error ensuring tables:', err);
    throw err;
  }
}

function validateReadOnlySql(queryText) {
  if (!queryText || typeof queryText !== 'string') {
    throw new Error('Invalid SQL string');
  }
  const lowered = queryText.trim().toLowerCase();
  if (!(lowered.startsWith('select') || lowered.startsWith('with'))) {
    throw new Error('Only SELECT/CTE queries are allowed');
  }
  const forbidden = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|set|begin|commit|rollback|;)\b/;
  if (forbidden.test(lowered)) {
    throw new Error('Query contains forbidden keywords');
  }
}

// read only layer.... uhhh yeah.... note to self (only server/admin should use)
async function read(queryText, params = []) {
  validateReadOnlySql(queryText);
  try {
    // unsafe needed because we accept dynamic query strings
    const result = await sql.unsafe(queryText, params);
    return result;
  } catch (err) {
    console.error('[read] error:', err);
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

async function getRecentContributions(limit = 100) {
  try {
    const contributions = await sql`
      SELECT
        fc.*,
        f.victim_id,
        f.created_at AS fight_created_at
      FROM fight_contributions fc
      JOIN fights f USING(fight_id)
      WHERE fc.fight_id IN (
        -- use the fights table to pick the most recent fights
        SELECT fight_id
        FROM fights
        ORDER BY created_at DESC
        LIMIT ${limit}
      )
      ORDER BY f.created_at DESC, fc.killer_id ASC
    `;
    return contributions;
  } catch (err) {
    console.error('[getRecentContributions] error:', err);
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
            const meDmgEnemy        = Math.round(k.myDmgToEnemy ?? 0);
      
            await tx`
              INSERT INTO fight_contributions
                (fight_id, killer_id, enemy_focus_percent, my_focus_percent, last_hit, since_fight_start, enemy_dmg_me, me_dmg_enemy)
              VALUES
                (${fight.fight_id}, ${killerKey}, ${enemyFocusPercent}, ${myFocusPercent}, ${lastHitSeconds}, ${timeSinceSeconds}, ${enemyDmgToMe}, ${meDmgEnemy})
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
  getContributionsByFightId,
  getRecentContributions,
  read
};
