const fs = require("fs");
const path = require("path");

const ignoredDirs = new Set(["node_modules", ".git", "dist"]);

function hashBuffer(buffer, seed) {
  let hash = seed;
  for (let i = 0; i < buffer.length; i++) {
    hash = ((hash << 5) + hash) + buffer[i];
    hash = hash & 0xffffffff;
  }
  return hash >>> 0;
}

function hashDirectory(dir, seed = 5381, ignoreDirs = ignoredDirs) {
  let hash = seed;
  const items = fs.readdirSync(dir).sort();

  for (const item of items) {
    if (ignoreDirs.has(item)) continue;

    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
      const content = fs.readFileSync(fullPath);
      hash = hashBuffer(content, hash);
    } else if (stat.isDirectory()) {
      hash = hashDirectory(fullPath, hash, ignoreDirs);
    }
  }
  return hash;
}

module.exports = { hashDirectory };
