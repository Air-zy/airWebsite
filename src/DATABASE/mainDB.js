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

/*
logFight(victimId, killers, raw)
 - victimId: number (roblox player id)
 - killers: array of { key, EnemyFocusAgainstMe, MyFocusAgainstEnemy, lastHitMe, timeSinceFightStarted }
 - raw: optional raw object to store in fights.raw_snapshot
 returns inserted fight_id on success.
*/
async function logFight(victimId, killers = [], raw = null) {
  if (!victimId) throw new Error('victimId required');

  return sql.begin(async (tx) => {
    // idempotent ensure players exist
    await tx`
      INSERT INTO players (player_id)
      VALUES (${victimId})
      ON CONFLICT (player_id) DO NOTHING
    `;

    for (const k of killers) {
      await tx`
        INSERT INTO players (player_id)
        VALUES (${k.key})
        ON CONFLICT (player_id) DO NOTHING
      `;
    }

    // insert fight
    const [fight] = await tx`
      INSERT INTO fights (victim_id, raw_snapshot)
      VALUES (${victimId}, ${raw})
      RETURNING fight_id
    `;

    // insert contributions (converting floats -> compact ints)
    for (const k of killers) {
      const enemyFocusPercent = Math.round((k.EnemyFocusAgainstMe ?? 0) * 100);
      const myFocusPercent = Math.round((k.MyFocusAgainstEnemy ?? 0) * 100);
      const lastHitMs = Math.round((k.lastHitMe ?? 0) * 1000);
      const timeSinceMs = Math.round((k.timeSinceFightStarted ?? 0) * 1000);

      await tx`
        INSERT INTO fight_contributions
          (fight_id, killer_id, enemy_focus_percent, my_focus_percent, last_hit_ms, time_since_fight_start_ms)
        VALUES
          (${fight.fight_id}, ${k.key}, ${enemyFocusPercent}, ${myFocusPercent}, ${lastHitMs}, ${timeSinceMs})
      `;
    }

    return fight.fight_id;
  });
}

module.exports = {
  sql,
  healthCheck,
  logFight,
};
