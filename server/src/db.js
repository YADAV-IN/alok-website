import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || './data/alok.db';

let dbPromise;

export const getDb = async () => {
  if (!dbPromise) {
    const dir = path.dirname(DB_PATH);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbPromise = open({ filename: DB_PATH, driver: sqlite3.Database });
  }
  return dbPromise;
};

export const initDb = async () => {
  const db = await getDb();
  await db.exec('PRAGMA foreign_keys = ON;');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT,
      cover_image_url TEXT,
      video_url TEXT,
      source TEXT,
      ai_summary TEXT,
      published_at TEXT NOT NULL,
      reading_time INTEGER DEFAULT 3,
      is_featured INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_name TEXT NOT NULL DEFAULT 'ALOK',
      site_subtitle TEXT NOT NULL DEFAULT 'बीजेएमसी न्यूज़',
      site_title TEXT NOT NULL DEFAULT 'ALOK - बीजेएमसी न्यूज़',
      site_description TEXT NOT NULL DEFAULT 'बीजेएमसी न्यूज़रूम - आपकी खबरों का भरोसेमंद स्रोत',
      updated_at TEXT NOT NULL
    );
  `);

  const adminCount = await db.get('SELECT COUNT(*) as count FROM admins');
  if (adminCount.count === 0) {
    const defaultEmail = process.env.ADMIN_EMAIL || 'vipno1official@gmail.com';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'preetam6388';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    await db.run(
      `INSERT INTO admins (name, email, password_hash, bio, avatar_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [
        process.env.ADMIN_NAME || 'ALOK एडमिन',
        defaultEmail,
        passwordHash,
        'डिजिटल न्यूज़रूम बिल्डर और BJMC स्टूडेंट प्रोफाइल।',
        '',
        new Date().toISOString(),
      ]
    );
  }
  
  const settingsCount = await db.get('SELECT COUNT(*) as count FROM site_settings');
  if (settingsCount.count === 0) {
    await db.run(
      `INSERT INTO site_settings (site_name, site_subtitle, site_title, site_description, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'ALOK',
        'बीजेएमसी न्यूज़',
        'ALOK - बीजेएमसी न्यूज़',
        'बीजेएमसी न्यूज़रूम - आपकी खबरों का भरोसेमंद स्रोत',
        new Date().toISOString(),
      ]
    );
  }
};
