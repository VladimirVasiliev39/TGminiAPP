const Database = require('better-sqlite3');
const path = require('path');


// Путь к файлу базы данных (находится рядом с этим файлом)
const dbPath = path.join(__dirname, 'shop.db');
const db = new Database(dbPath);

// Включаем поддержку внешних ключей (полезно для целостности)
db.pragma('foreign_keys = ON');

module.exports = db;