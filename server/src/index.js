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
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
  const isMatch = await bcrypt.compare(password, admin.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = signToken(admin.id);
  return res.json({
    data: {
      token,
      profile: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        bio: admin.bio,
        avatar_url: admin.avatar_url,
      },
    },
  });
});

app.post('/api/admins', requireAuth, async (req, res) => {
  const { name, email, password, bio } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required.' });
  }
  const db = await getDb();
  const existing = await db.get('SELECT id FROM admins WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ error: 'Email already exists.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO admins (name, email, password_hash, bio, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [name, email, passwordHash, bio || '', '', now]
  );
  const admin = await db.get('SELECT * FROM admins WHERE id = ?', [result.lastID]);
  return res.status(201).json({
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      bio: admin.bio,
      avatar_url: admin.avatar_url,
    },
  });
});

app.get('/api/admins', requireAuth, async (req, res) => {
  const db = await getDb();
  const admins = await db.all(
    'SELECT id, name, email, bio, avatar_url, created_at FROM admins ORDER BY datetime(created_at) DESC'
  );
  return res.json({ data: admins });
});

app.put('/api/admins/:id/password', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Password required.' });
  }
  const db = await getDb();
  const existing = await db.get('SELECT id FROM admins WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Admin not found.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  return res.json({ data: { id: Number(id) } });
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
      bio: admin.bio,
      avatar_url: admin.avatar_url,
    },
  });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, email, bio } = req.body || {};
  const db = await getDb();
  await db.run(
    `UPDATE admins SET name = ?, email = ?, bio = ? WHERE id = ?`,
    [name, email, bio, req.adminId]
  );
  const admin = await db.get('SELECT * FROM admins WHERE id = ?', [req.adminId]);
  return res.json({
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
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
  await db.run('UPDATE admins SET avatar_url = ? WHERE id = ?', [avatarUrl, req.adminId]);
  const admin = await db.get('SELECT * FROM admins WHERE id = ?', [req.adminId]);
  return res.json({
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
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
    video_url,
    source,
    ai_summary,
    published_at,
    is_featured,
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
      (title, slug, excerpt, content, category, tags, cover_image_url, video_url, source, ai_summary, published_at, reading_time, is_featured, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      title,
      slug,
      excerpt,
      content,
      category || 'कैंपस',
      JSON.stringify(tags),
      cover_image_url,
      video_url,
      source,
      ai_summary,
      published_at || now,
      readingTime,
      is_featured ? 1 : 0,
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
    video_url: req.body.video_url ?? existing.video_url,
    source: req.body.source ?? existing.source,
    ai_summary: req.body.ai_summary ?? existing.ai_summary,
    published_at: req.body.published_at ?? existing.published_at,
    is_featured: req.body.is_featured ?? existing.is_featured,
  };

  const updatedAt = new Date().toISOString();
  await db.run(
    `UPDATE news SET
      title = ?,
      excerpt = ?,
      content = ?,
      category = ?,
      tags = ?,
      cover_image_url = ?,
      video_url = ?,
      source = ?,
      ai_summary = ?,
      published_at = ?,
      reading_time = ?,
      is_featured = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      payload.title,
      payload.excerpt,
      payload.content,
      payload.category,
      JSON.stringify(payload.tags),
      payload.cover_image_url,
      payload.video_url,
      payload.source,
      payload.ai_summary,
      payload.published_at,
      getReadingTime(payload.content),
      payload.is_featured ? 1 : 0,
      updatedAt,
      id,
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
