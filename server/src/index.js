import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { initDb, getDb } from './db.js';
import { requireAuth, signToken } from './middleware/auth.js';
import { slugify, ensureUniqueSlug } from './utils/slug.js';
import { getReadingTime } from './utils/readingTime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const IS_VERCEL = process.env.VERCEL === '1';
const UPLOAD_DIR = process.env.UPLOAD_DIR || (IS_VERCEL ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads'));

const ensureDir = (dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create dir:', dir, err.message);
  }
};

ensureDir(UPLOAD_DIR);
ensureDir(path.join(UPLOAD_DIR, 'avatars'));
ensureDir(path.join(UPLOAD_DIR, 'covers'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'avatar' ? 'avatars' : 'covers';
    cb(null, path.join(UPLOAD_DIR, folder));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({ storage });

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

let dbInitialized = false;
let dbInitPromise = null;

const ensureDbInit = async () => {
  if (dbInitialized) return;
  if (!dbInitPromise) {
    dbInitPromise = initDb().then(() => { dbInitialized = true; }).catch(err => {
      console.error('DB init error:', err);
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
};

// Initialize DB on first request (lazy init for Vercel)
app.use(async (req, res, next) => {
  try {
    await ensureDbInit();
    next();
  } catch (err) {
    console.error('DB init middleware error:', err);
    return res.status(500).json({ error: 'Database initialization failed' });
  }
});

app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), vercel: IS_VERCEL });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }
  const db = await getDb();
  const admin = await db.get('SELECT * FROM admins WHERE email = ?', [email]);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  if (admin.id !== 1) {
    return res.status(403).json({ error: 'Only primary admin can log in.' });
  }
  if (admin.status !== 'active') {
    return res.status(403).json({ error: 'Account is inactive. Contact administrator.' });
  }
  const isMatch = await bcrypt.compare(password, admin.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  
  // Update last login
  const now = new Date().toISOString();
  await db.run('UPDATE admins SET last_login = ? WHERE id = ?', [now, admin.id]);
  
  const token = signToken(admin.id);
  return res.json({
    data: {
      token,
      profile: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role || 'author',
        status: admin.status || 'active',
        bio: admin.bio,
        avatar_url: admin.avatar_url,
        last_login: now,
      },
    },
  });
});

app.post('/api/admins', requireAuth, async (req, res) => {
  const db = await getDb();
  const currentUser = await db.get('SELECT role FROM admins WHERE id = ?', [req.adminId]);
  
  // Only admins can create users
  if (currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied. Admin access required.' });
  }

  const { name, email, password, role = 'author', bio = '' } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required.' });
  }
  
  const existing = await db.get('SELECT id FROM admins WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ error: 'Email already exists.' });
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO admins (name, email, password_hash, role, status, bio, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, passwordHash, role, 'active', bio, '', now, now]
  );
  
  const admin = await db.get('SELECT id, name, email, role, status, bio, avatar_url, created_at FROM admins WHERE id = ?', [result.lastID]);
  return res.status(201).json({ data: admin });
});

app.get('/api/admins', requireAuth, async (req, res) => {
  const db = await getDb();
  const admins = await db.all(
    `SELECT id, name, email, role, status, bio, avatar_url, last_login, created_at, updated_at 
     FROM admins ORDER BY 
     CASE role 
       WHEN 'admin' THEN 1 
       WHEN 'editor' THEN 2 
       WHEN 'author' THEN 3 
     END, 
     datetime(created_at) DESC`
  );
  return res.json({ data: admins });
});

app.put('/api/admins/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  
  const currentUser = await db.get('SELECT role FROM admins WHERE id = ?', [req.adminId]);
  const targetUser = await db.get('SELECT * FROM admins WHERE id = ?', [id]);
  
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Only admins can edit other users, or users can edit themselves (limited)
  if (currentUser.role !== 'admin' && req.adminId !== parseInt(id)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  const { name, email, role, status, bio } = req.body || {};
  const now = new Date().toISOString();
  
  // Non-admins cannot change role or status
  if (currentUser.role !== 'admin' && (role || status)) {
    return res.status(403).json({ error: 'Cannot change role or status.' });
  }

  await db.run(
    `UPDATE admins SET name = ?, email = ?, role = ?, status = ?, bio = ?, updated_at = ? WHERE id = ?`,
    [
      name || targetUser.name,
      email || targetUser.email,
      role || targetUser.role,
      status || targetUser.status,
      bio !== undefined ? bio : targetUser.bio,
      now,
      id
    ]
  );

  const updated = await db.get('SELECT id, name, email, role, status, bio, avatar_url, created_at, updated_at FROM admins WHERE id = ?', [id]);
  return res.json({ data: updated });
});

app.put('/api/admins/:id/password', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  
  if (!password) {
    return res.status(400).json({ error: 'Password required.' });
  }
  
  const db = await getDb();
  const currentUser = await db.get('SELECT role FROM admins WHERE id = ?', [req.adminId]);
  
  // Only admins can change other users' passwords
  if (currentUser.role !== 'admin' && req.adminId !== parseInt(id)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  const existing = await db.get('SELECT id FROM admins WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: 'User not found.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  await db.run('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, now, id]);
  return res.json({ data: { id: Number(id), message: 'Password updated successfully' } });
});

app.delete('/api/admins/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  
  const currentUser = await db.get('SELECT role FROM admins WHERE id = ?', [req.adminId]);
  
  // Only admins can delete users
  if (currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied. Admin access required.' });
  }
  
  // Prevent deleting yourself
  if (req.adminId === parseInt(id)) {
    return res.status(400).json({ error: 'Cannot delete your own account.' });
  }
  
  const targetUser = await db.get('SELECT * FROM admins WHERE id = ?', [id]);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }
  
  // Prevent deleting the primary admin (id = 1)
  if (parseInt(id) === 1) {
    return res.status(400).json({ error: 'Cannot delete primary admin account.' });
  }
  
  await db.run('DELETE FROM admins WHERE id = ?', [id]);
  return res.json({ data: { id: Number(id), message: 'User deleted successfully' } });
});

app.get('/api/profile', requireAuth, async (req, res) => {
  const db = await getDb();
  const admin = await db.get('SELECT * FROM admins WHERE id = ?', [req.adminId]);
  if (!admin) {
    return res.status(404).json({ error: 'Profile not found.' });
  }
  return res.json({
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role || 'author',
      status: admin.status || 'active',
      bio: admin.bio,
      avatar_url: admin.avatar_url,
      last_login: admin.last_login,
    },
  });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, email, bio } = req.body || {};
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    `UPDATE admins SET name = ?, email = ?, bio = ?, updated_at = ? WHERE id = ?`,
    [name, email, bio, now, req.adminId]
  );
  const admin = await db.get('SELECT * FROM admins WHERE id = ?', [req.adminId]);
  return res.json({
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role || 'author',
      status: admin.status || 'active',
      bio: admin.bio,
      avatar_url: admin.avatar_url,
    },
  });
});

app.post('/api/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const db = await getDb();
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const now = new Date().toISOString();
  await db.run('UPDATE admins SET avatar_url = ?, updated_at = ? WHERE id = ?', [avatarUrl, now, req.adminId]);
  const admin = await db.get('SELECT * FROM admins WHERE id = ?', [req.adminId]);
  return res.json({
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role || 'author',
      status: admin.status || 'active',
      bio: admin.bio,
      avatar_url: admin.avatar_url,
    },
  });
});

app.get('/api/news', async (req, res) => {
  const { limit = 12, category, q } = req.query;
  const db = await getDb();
  const filters = [];
  const params = [];
  if (category) {
    filters.push('category = ?');
    params.push(category);
  }
  if (q) {
    filters.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await db.all(
    `SELECT * FROM news ${where} ORDER BY datetime(published_at) DESC LIMIT ?`,
    [...params, Number(limit)]
  );
  const payload = rows.map((row) => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
  }));
  return res.json({ data: payload });
});

app.get('/api/news/:slug', async (req, res) => {
  const { slug } = req.params;
  const db = await getDb();
  const row = await db.get('SELECT * FROM news WHERE slug = ?', [slug]);
  if (!row) {
    return res.status(404).json({ error: 'News not found.' });
  }
  await db.run('UPDATE news SET views = views + 1 WHERE id = ?', [row.id]);
  return res.json({
    data: {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      views: row.views + 1,
    },
  });
});

app.post('/api/news', requireAuth, async (req, res) => {
  const {
    title,
    excerpt,
    content,
    category,
    tags = [],
    cover_image_url,
    gallery_urls,
    video_url,
    audio_url,
    source,
    ai_summary,
    author_name,
    author_email,
    author_twitter,
    author_instagram,
    meta_description,
    meta_keywords,
    seo_title,
    location,
    coordinates,
    twitter_url,
    facebook_url,
    instagram_url,
    youtube_url,
    published_at,
    is_featured,
    is_breaking,
    status,
    priority,
    language,
    expire_at,
  } = req.body || {};

  if (!title || !excerpt || !content) {
    return res.status(400).json({ error: 'Title, excerpt, and content required.' });
  }

  const db = await getDb();
  const baseSlug = slugify(title);
  const slug = await ensureUniqueSlug(db, baseSlug);
  const now = new Date().toISOString();
  const readingTime = getReadingTime(content);

  const result = await db.run(
    `INSERT INTO news
      (title, slug, excerpt, content, category, tags, cover_image_url, gallery_urls, video_url, audio_url, source, ai_summary,
       author_name, author_email, author_twitter, author_instagram, meta_description, meta_keywords, seo_title,
       location, coordinates, twitter_url, facebook_url, instagram_url, youtube_url,
       published_at, reading_time, is_featured, is_breaking, status, priority, language, expire_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      slug,
      excerpt,
      content,
      category || 'कैंपस',
      JSON.stringify(tags),
      cover_image_url,
      gallery_urls,
      video_url,
      audio_url,
      source,
      ai_summary,
      author_name,
      author_email,
      author_twitter,
      author_instagram,
      meta_description,
      meta_keywords,
      seo_title,
      location,
      coordinates,
      twitter_url,
      facebook_url,
      instagram_url,
      youtube_url,
      published_at || now,
      readingTime,
      is_featured ? 1 : 0,
      is_breaking ? 1 : 0,
      status || 'published',
      priority || 'normal',
      language || 'hi',
      expire_at,
      now,
      now,
    ]
  );

  const created = await db.get('SELECT * FROM news WHERE id = ?', [result.lastID]);
  return res.status(201).json({
    data: {
      ...created,
      tags: created.tags ? JSON.parse(created.tags) : [],
    },
  });
});

app.put('/api/news/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  const existing = await db.get('SELECT * FROM news WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: 'News not found.' });
  }
  const payload = {
    title: req.body.title ?? existing.title,
    excerpt: req.body.excerpt ?? existing.excerpt,
    content: req.body.content ?? existing.content,
    category: req.body.category ?? existing.category,
    tags: req.body.tags ?? (existing.tags ? JSON.parse(existing.tags) : []),
    cover_image_url: req.body.cover_image_url ?? existing.cover_image_url,
    gallery_urls: req.body.gallery_urls ?? existing.gallery_urls,
    video_url: req.body.video_url ?? existing.video_url,
    audio_url: req.body.audio_url ?? existing.audio_url,
    source: req.body.source ?? existing.source,
    ai_summary: req.body.ai_summary ?? existing.ai_summary,
    author_name: req.body.author_name ?? existing.author_name,
    author_email: req.body.author_email ?? existing.author_email,
    author_twitter: req.body.author_twitter ?? existing.author_twitter,
    author_instagram: req.body.author_instagram ?? existing.author_instagram,
    meta_description: req.body.meta_description ?? existing.meta_description,
    meta_keywords: req.body.meta_keywords ?? existing.meta_keywords,
    seo_title: req.body.seo_title ?? existing.seo_title,
    location: req.body.location ?? existing.location,
    coordinates: req.body.coordinates ?? existing.coordinates,
    twitter_url: req.body.twitter_url ?? existing.twitter_url,
    facebook_url: req.body.facebook_url ?? existing.facebook_url,
    instagram_url: req.body.instagram_url ?? existing.instagram_url,
    youtube_url: req.body.youtube_url ?? existing.youtube_url,
    published_at: req.body.published_at ?? existing.published_at,
    is_featured: req.body.is_featured ?? existing.is_featured,
    is_breaking: req.body.is_breaking ?? existing.is_breaking,
    status: req.body.status ?? existing.status ?? 'published',
    priority: req.body.priority ?? existing.priority ?? 'normal',
    language: req.body.language ?? existing.language ?? 'hi',
    expire_at: req.body.expire_at ?? existing.expire_at,
  };

  const updatedAt = new Date().toISOString();
  await db.run(
    `UPDATE news SET
      title = ?, excerpt = ?, content = ?, category = ?, tags = ?,
      cover_image_url = ?, gallery_urls = ?, video_url = ?, audio_url = ?, source = ?, ai_summary = ?,
      author_name = ?, author_email = ?, author_twitter = ?, author_instagram = ?,
      meta_description = ?, meta_keywords = ?, seo_title = ?,
      location = ?, coordinates = ?,
      twitter_url = ?, facebook_url = ?, instagram_url = ?, youtube_url = ?,
      published_at = ?, reading_time = ?, is_featured = ?, is_breaking = ?,
      status = ?, priority = ?, language = ?, expire_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      payload.title, payload.excerpt, payload.content, payload.category, JSON.stringify(payload.tags),
      payload.cover_image_url, payload.gallery_urls, payload.video_url, payload.audio_url, payload.source, payload.ai_summary,
      payload.author_name, payload.author_email, payload.author_twitter, payload.author_instagram,
      payload.meta_description, payload.meta_keywords, payload.seo_title,
      payload.location, payload.coordinates,
      payload.twitter_url, payload.facebook_url, payload.instagram_url, payload.youtube_url,
      payload.published_at, getReadingTime(payload.content), 
      payload.is_featured ? 1 : 0, payload.is_breaking ? 1 : 0,
      payload.status, payload.priority, payload.language, payload.expire_at,
      updatedAt, id,
    ]
  );

  const updated = await db.get('SELECT * FROM news WHERE id = ?', [id]);
  return res.json({
    data: {
      ...updated,
      tags: updated.tags ? JSON.parse(updated.tags) : [],
    },
  });
});

app.delete('/api/news/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  await db.run('DELETE FROM news WHERE id = ?', [id]);
  return res.status(204).send();
});

app.post('/api/uploads/cover', requireAuth, upload.single('cover'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const coverUrl = `/uploads/covers/${req.file.filename}`;
  return res.json({ data: { url: coverUrl } });
});

// Site Settings endpoints
app.get('/api/settings', async (req, res) => {
  const db = await getDb();
  const settings = await db.get('SELECT * FROM site_settings ORDER BY id DESC LIMIT 1');
  return res.json({ data: settings });
});

app.put('/api/settings', requireAuth, async (req, res) => {
  const { site_name, site_subtitle, site_title, site_description } = req.body || {};
  const db = await getDb();
  
  const existing = await db.get('SELECT * FROM site_settings ORDER BY id DESC LIMIT 1');
  if (!existing) {
    // Create if doesn't exist
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO site_settings (site_name, site_subtitle, site_title, site_description, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        site_name || 'ALOK',
        site_subtitle || 'बीजेएमसी न्यूज़',
        site_title || 'ALOK - बीजेएमसी न्यूज़',
        site_description || 'बीजेएमसी न्यूज़रूम - आपकी खबरों का भरोसेमंद स्रोत',
        now
      ]
    );
  } else {
    // Update existing
    const updatedAt = new Date().toISOString();
    await db.run(
      `UPDATE site_settings SET site_name = ?, site_subtitle = ?, site_title = ?, site_description = ?, updated_at = ? WHERE id = ?`,
      [
        site_name ?? existing.site_name,
        site_subtitle ?? existing.site_subtitle,
        site_title ?? existing.site_title,
        site_description ?? existing.site_description,
        updatedAt,
        existing.id
      ]
    );
  }
  
  const settings = await db.get('SELECT * FROM site_settings ORDER BY id DESC LIMIT 1');
  return res.json({ data: settings });
});

app.use((error, req, res, next) => {
  console.error(error);
  return res.status(500).json({ error: 'Unexpected server error.' });
});

// Only listen when NOT on Vercel (Vercel handles this itself)
if (!IS_VERCEL) {
  initDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`ALOK API running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Failed to init DB', error);
      process.exit(1);
    });
}

// Export for Vercel serverless
export default app;
