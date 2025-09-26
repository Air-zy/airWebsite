const { getSQL } = require("./parseSQL.js")
const sql = getSQL(process.env.UTIL_DB);

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
    // animeData
    await sql`
      CREATE TABLE big_value (
        id integer PRIMARY KEY,  -- e.g. always use id = 1
        data bytea NOT NULL
      );
    `;
    console.log('[POSTGRES_DB] Tables ensured');
  } catch (err) {
    console.error('[POSTGRES_DB] Error ensuring tables:', err);
    throw err;
  }
}

const zlib = require('zlib');
async function setAnimeData(animeMap) {
  try {
    const animeObj = Object.fromEntries(animeMap);
    const jsonStr = JSON.stringify(animeObj);
    const compressedData = zlib.gzipSync(JSON.stringify(animeObj));

    const beforeMB = (Buffer.byteLength(jsonStr) / (1024 ** 2)).toFixed(4);
    const afterMB = (compressedData.length / (1024 ** 2)).toFixed(4);

    console.log(`[setAnimeData] animeMap Before: ${beforeMB} MB`);
    console.log(`[setAnimeData] animeMap After:  ${afterMB} MB`);

    await sql`
      INSERT INTO big_value (id, data)
      VALUES (1, ${compressedData})
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
    `;
    console.log('[POSTGRES_DB] Big value set successfully');
  } catch (err) {
    console.error('[POSTGRES_DB] Error setting big value:', err);
    throw err;
  }
}

async function getAnimeDataCompressed() {
  try {
    const rows = await sql`SELECT data FROM big_value WHERE id = 1`;
    if (rows.length === 0) {
      console.log('[POSTGRES_DB] No data found');
      return null;
    }

    const compressedData = rows[0].data;
    console.log('[POSTGRES_DB] Compressed big value fetched successfully');
    return compressedData; // still Buffer (gzipped)
  } catch (err) {
    console.error('[POSTGRES_DB] Error getting compressed big value:', err);
    throw err;
  }
}


module.exports = {
  sql,
  healthCheck,
  ensureTables,
  setAnimeData,
  getAnimeDataCompressed
};
