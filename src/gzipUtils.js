const zlib = require('zlib');

// todo maybe use gzipSync insteaad of aall of this lmao
function gunzipAsync(buffer) {
  return new Promise((resolve, reject) => {
    zlib.gunzip(buffer, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

function gzipAsync(data) {
  return new Promise((resolve, reject) => {
    zlib.gzip(data, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

module.exports = { gunzipAsync, gzipAsync };