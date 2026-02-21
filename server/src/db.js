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
      role TEXT DEFAULT 'author',
      status TEXT DEFAULT 'active',
      bio TEXT,
      avatar_url TEXT,
      last_login TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
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
      is_breaking INTEGER DEFAULT 0,
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

  // Migration: Add is_breaking column if not exists
  try {
    const tableInfo = await db.all('PRAGMA table_info(news)');
    const hasBreakingColumn = tableInfo.some(col => col.name === 'is_breaking');
    if (!hasBreakingColumn) {
      await db.exec('ALTER TABLE news ADD COLUMN is_breaking INTEGER DEFAULT 0');
      console.log('✅ Added is_breaking column to news table');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }

  // Migration: Add role and status columns to admins if not exist
  try {
    const adminTableInfo = await db.all('PRAGMA table_info(admins)');
    const adminColumns = adminTableInfo.map(col => col.name);
    
    if (!adminColumns.includes('role')) {
      await db.exec('ALTER TABLE admins ADD COLUMN role TEXT DEFAULT \'author\'');
      console.log('✅ Added role column to admins table');
    }
    if (!adminColumns.includes('status')) {
      await db.exec('ALTER TABLE admins ADD COLUMN status TEXT DEFAULT \'active\'');
      console.log('✅ Added status column to admins table');
    }
    if (!adminColumns.includes('last_login')) {
      await db.exec('ALTER TABLE admins ADD COLUMN last_login TEXT');
      console.log('✅ Added last_login column to admins table');
    }
    if (!adminColumns.includes('updated_at')) {
      await db.exec('ALTER TABLE admins ADD COLUMN updated_at TEXT');
      console.log('✅ Added updated_at column to admins table');
    }
  } catch (error) {
    console.error('Admin table migration error:', error);
  }

  // Migration: Add advanced fields if not exist
  try {
    const tableInfo = await db.all('PRAGMA table_info(news)');
    const columns = tableInfo.map(col => col.name);
    
    const newColumns = [
      { name: 'gallery_urls', type: 'TEXT', default: null },
      { name: 'audio_url', type: 'TEXT', default: null },
      { name: 'author_name', type: 'TEXT', default: null },
      { name: 'author_email', type: 'TEXT', default: null },
      { name: 'author_twitter', type: 'TEXT', default: null },
      { name: 'author_instagram', type: 'TEXT', default: null },
      { name: 'meta_description', type: 'TEXT', default: null },
      { name: 'meta_keywords', type: 'TEXT', default: null },
      { name: 'seo_title', type: 'TEXT', default: null },
      { name: 'location', type: 'TEXT', default: null },
      { name: 'coordinates', type: 'TEXT', default: null },
      { name: 'twitter_url', type: 'TEXT', default: null },
      { name: 'facebook_url', type: 'TEXT', default: null },
      { name: 'instagram_url', type: 'TEXT', default: null },
      { name: 'youtube_url', type: 'TEXT', default: null },
      { name: 'status', type: 'TEXT', default: 'published' },
      { name: 'priority', type: 'TEXT', default: 'normal' },
      { name: 'language', type: 'TEXT', default: 'hi' },
      { name: 'expire_at', type: 'TEXT', default: null }
    ];

    for (const col of newColumns) {
      if (!columns.includes(col.name)) {
        const defaultClause = col.default !== null ? ` DEFAULT '${col.default}'` : '';
        await db.exec(`ALTER TABLE news ADD COLUMN ${col.name} ${col.type}${defaultClause}`);
        console.log(`✅ Added ${col.name} column to news table`);
      }
    }
  } catch (error) {
    console.error('Advanced fields migration error:', error);
  }

  const adminCount = await db.get('SELECT COUNT(*) as count FROM admins');
  const defaultEmail = process.env.ADMIN_EMAIL || 'vipno1official@gmail.com';
  const defaultPassword = process.env.ADMIN_PASSWORD || 'preetam6388';
  const defaultName = process.env.ADMIN_NAME || 'ALOK एडमिन';
  if (adminCount.count === 0) {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO admins (name, email, password_hash, role, status, bio, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        defaultName,
        defaultEmail,
        passwordHash,
        'admin',
        'active',
        'डिजिटल न्यूज़रूम बिल्डर और BJMC स्टूडेंट प्रोफाइल।',
        '',
        now,
        now,
      ]
    );
    console.log('✅ Primary admin created:', defaultEmail);
  } else {
    // Enforce primary admin credentials and role
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const now = new Date().toISOString();
    await db.run(
      'UPDATE admins SET name = ?, email = ?, password_hash = ?, role = \'admin\', status = \'active\', updated_at = ? WHERE id = 1',
      [defaultName, defaultEmail, passwordHash, now]
    );
    console.log('✅ Primary admin credentials updated');
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
