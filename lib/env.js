/* Простой загрузчик .env (без зависимостей) */
const fs = require('fs');
const path = require('path');

function loadEnv(root) {
  try {
    fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).forEach(line => {
      if (line.trim().startsWith('#')) return;
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    });
  } catch (e) { /* .env необязателен */ }
}

module.exports = { loadEnv };
