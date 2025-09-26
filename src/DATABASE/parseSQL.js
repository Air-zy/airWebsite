const envDecrypt = require('../envDecrypt.js');
const postgres = require('postgres');

function tryDecrypt(envVal) {
  return envDecrypt(process.env.airKey, envVal);
}

function getSQL(encEnv) {
    const decryptedJson = tryDecrypt(encEnv);
    const dbConfig = JSON.parse(decryptedJson);

    const MAX_CONNS = 5;
    const sql = postgres({
    host:     dbConfig.host,
    database: dbConfig.name,
    username: dbConfig.user,
    password: dbConfig.pass,
    port:     dbConfig.port,

    max: MAX_CONNS,
    idle_timeout: 10_000,
    connect_timeout: 30_000,
    ssl: 'require'
    });

    return sql
}

module.exports = { getSQL }