# Quick Setup Guide - BJMC News Portal

## 🚀 For AI Agents

यह document किसी भी AI agent के लिए है जो इस project को समझना या continue करना चाहे।

---

## 📍 Current Status (February 19, 2026)

### ✅ Deployed & Working
- **Frontend:** https://codespaces-react-rho-ashen.vercel.app
- **Backend:** https://server-tan-iota-18.vercel.app
- **Git:** All code committed

### ⚠️ Incomplete Tasks
1. **Database Migration** (CRITICAL) - SQLite को PostgreSQL में migrate करना है
2. **Environment Variables** - Vercel dashboard में set करने हैं
3. **CORS Update** - Backend में production URLs add करने हैं

---

## 🎯 What This Project Is

**Type:** Multi-language News Portal (Hindi + English)

**Key Features:**
- 🌐 Auto language detection (browser language)
- 🔤 Manual language switcher (हि/EN buttons)
- 📸 Translation tool with OCR (images से text extract करके translate)
- 🔐 Admin panel (JWT authentication)
- ✏️ Full CRUD (Create, Read, Update, Delete news)
- 📱 Mobile responsive
- 🎨 Modern UI (gradients, animations, glassmorphism)
- ⚙️ Site settings management

---

## 📂 Important Files

### Frontend (React + Vite)
```
src/
├── App.jsx                      # Main component (1342 lines)
├── App.css                      # Styles (2270 lines)
├── translations.js              # Language dictionaries (Hindi/English)
├── utils/translator.js          # Translation API + OCR logic
└── components/
    ├── TranslationTool.jsx      # Translation modal UI
    └── TranslationTool.css      # Translation modal styles
```

### Backend (Node.js + Express)
```
server/src/
├── index.js                     # API routes (200+ lines)
├── db.js                        # Database setup (SQLite → needs PostgreSQL)
└── middleware/auth.js           # JWT authentication
```

### Config Files
```
vercel.json                      # Frontend deployment config
server/vercel.json               # Backend deployment config
```

---

## 🔧 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18.2.0 | UI Library |
| Build Tool | Vite 6.3.6 | Dev server + bundler |
| Styling | CSS3 | Modern designs |
| Translation | MyMemory API | Free translation service |
| OCR | Tesseract.js | Image text extraction |
| Backend | Express.js | REST API |
| Auth | JWT | Token-based authentication |
| Database | SQLite → PostgreSQL | Data storage (migration needed) |
| Hosting | Vercel | Serverless deployment |

---

## 🗃️ Database Schema

### Tables

**users**
- id (PRIMARY KEY)
- username (UNIQUE)
- password (hashed with bcrypt)
- avatar (base64 image)
- created_at

**categories**
- id (PRIMARY KEY)
- name (Hindi name like "राजनीति")
- slug (English slug like "politics")

**news**
- id (PRIMARY KEY)
- title
- description
- content
- image_url
- category_id (FOREIGN KEY → categories)
- author
- publish_date (formatted: "19 फरवरी 2026, शाम 5:30")
- is_breaking (BOOLEAN)
- is_trending (BOOLEAN)
- views
- created_at

**site_settings**
- id (PRIMARY KEY)
- site_name
- site_subtitle
- site_title
- site_description
- updated_at

---

## 🔌 API Endpoints

### Public
```
GET  /api/news          # All news with category info
GET  /api/categories    # All categories
GET  /api/settings      # Site settings
```

### Authentication
```
POST /api/register      # Create admin (disable in production)
POST /api/login         # Login (returns JWT token)
```

### Protected (require JWT token in header)
```
POST   /api/news             # Create news
PUT    /api/news/:id         # Update news
DELETE /api/news/:id         # Delete news
PUT    /api/settings         # Update site settings
POST   /api/upload-avatar    # Upload profile picture
```

**Header Format:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🌐 Translation System

### How It Works

1. **Auto-Detection:**
   ```javascript
   // Checks browser language
   const browserLang = navigator.language; // "hi-IN" or "en-US"
   // Sets Hindi if starts with "hi", else English
   ```

2. **Translation Keys:**
   ```javascript
   // All UI text in translations.js
   translations = {
     en: { siteName: "BJMC News", ... },
     hi: { siteName: "बीजेएमसी समाचार", ... }
   }
   
   // Usage in components:
   t('siteName', language) // Returns translated text
   ```

3. **Translation Tool:**
   - **Text Mode:** Calls MyMemory API
   - **Image Mode:** 
     1. Tesseract.js extracts text from image
     2. Detects language (Devanagari Unicode check)
     3. Translates to opposite language

---

## 🎨 Design System

### Colors
- Primary: `#FF6B6B` (Red)
- Secondary: `#4ECDC4` (Teal)
- Accent: `#45B7D1` (Blue)
- Background: Gradient (purple → pink → orange)

### Breakpoints
- Desktop: `> 767px`
- Mobile: `< 767px`
- Small Mobile: `< 374px`

### Effects
- Glassmorphism: `backdrop-filter: blur(10px)`
- Animations: Fade-in, slide-up, scale on hover
- Shadows: Multi-layer for depth

---

## 🚨 Critical Issues to Fix

### Issue 1: Database Migration (HIGHEST PRIORITY)

**Problem:** SQLite doesn't work on Vercel (read-only filesystem)

**Solution:** Migrate to PostgreSQL

**Steps:**
1. Read: [BACKEND_MIGRATION_GUIDE.md](BACKEND_MIGRATION_GUIDE.md)
2. Create Vercel Postgres database
3. Update `server/src/db.js` (replace SQLite code with PostgreSQL)
4. Update all API routes in `server/src/index.js` (change callbacks to async/await)
5. Add `DATABASE_URL` environment variable in Vercel
6. Redeploy backend

**Estimated Time:** 30 minutes

**Files to Modify:**
- `server/src/db.js` (complete rewrite)
- `server/src/index.js` (10 route handlers)
- `server/package.json` (add `pg` dependency)

---

### Issue 2: Environment Variables

**Frontend needs:**
```bash
VITE_API_URL=https://server-tan-iota-18.vercel.app
```

**Backend needs:**
```bash
DATABASE_URL=postgres://...
JWT_SECRET=your-secret-key-32-chars-minimum
NODE_ENV=production
```

**Where to add:** Vercel Dashboard → Project → Settings → Environment Variables

---

### Issue 3: CORS Configuration

**File:** `server/src/index.js`

**Current (line ~15):**
```javascript
app.use(cors());
```

**Should be:**
```javascript
app.use(cors({
  origin: [
    'https://codespaces-react-rho-ashen.vercel.app',
    'https://codespaces-react-3yt9kjhkn-preetam-yadavs-projects.vercel.app',
    'http://localhost:5173'
  ],
  credentials: true
}));
```

---

## 🛠️ How to Continue Development

### If Working Locally

```bash
# 1. Clone repo
git clone [repo-url]
cd codespaces-react

# 2. Install dependencies
npm install
cd server && npm install && cd ..

# 3. Start backend (Terminal 1)
cd server
npm start  # Runs on http://localhost:5000

# 4. Start frontend (Terminal 2)
npm run dev  # Runs on http://localhost:5173

# 5. Create admin account
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 6. Test login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### If Modifying Code

**Frontend Changes:**
```bash
# Make changes in src/ folder
# Vite hot-reloads automatically
# Build for production:
npm run build
# Deploy:
vercel --prod
```

**Backend Changes:**
```bash
# Make changes in server/src/ folder
# Restart server: Ctrl+C then npm start
# Deploy:
cd server
vercel --prod
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) | Complete project overview |
| [BACKEND_MIGRATION_GUIDE.md](BACKEND_MIGRATION_GUIDE.md) | PostgreSQL migration steps |
| [DEPLOY.md](DEPLOY.md) | Vercel deployment instructions |
| [README.md](README.md) | Original project README |
| QUICK_SETUP.md | This file (quick reference) |

---

## 🔍 Common Tasks

### Add New Translation Key

1. **Edit:** `src/translations.js`
   ```javascript
   export const translations = {
     en: {
       // ... existing keys
       newKey: "English Text"
     },
     hi: {
       // ... existing keys
       newKey: "हिंदी पाठ"
     }
   };
   ```

2. **Use in component:**
   ```javascript
   {t('newKey', language)}
   ```

### Add New API Endpoint

1. **Edit:** `server/src/index.js`
   ```javascript
   app.get('/api/new-endpoint', async (req, res) => {
     try {
       const result = await db.query('SELECT ...');
       res.json(result.rows);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   ```

2. **Call from frontend:**
   ```javascript
   const response = await fetch(`${import.meta.env.VITE_API_URL}/api/new-endpoint`);
   const data = await response.json();
   ```

### Add New Category

```sql
INSERT INTO categories (name, slug) 
VALUES ('नया श्रेणी', 'new-category');
```

Or via SQL client connected to your database.

---

## 🧪 Testing Checklist

After making changes, test:

- [ ] Frontend loads without errors
- [ ] Language switcher works (हि ↔ EN)
- [ ] Translation tool opens (🌐 button)
- [ ] Text translation works
- [ ] Image OCR works
- [ ] Admin login successful
- [ ] Create news saves to database
- [ ] Edit news updates correctly
- [ ] Delete news removes from database
- [ ] Site settings update
- [ ] Mobile view responsive
- [ ] All news cards display
- [ ] Category filter works
- [ ] Breaking news ticker scrolls
- [ ] API endpoints respond

---

## 🆘 Help Commands

```bash
# Check Vercel deployment status
vercel ls

# View deployment logs
vercel logs [deployment-url]

# Check environment variables
vercel env ls

# Pull environment variables locally
vercel env pull

# Check which Vercel account is logged in
vercel whoami

# Build frontend locally
npm run build

# Preview production build
npm run preview

# Check for errors
npm run lint

# Test API locally
curl http://localhost:5000/api/news
```

---

## 🎯 Next Steps (Priority Order)

1. **CRITICAL:** Database migration to PostgreSQL
   - Read: [BACKEND_MIGRATION_GUIDE.md](BACKEND_MIGRATION_GUIDE.md)
   - Estimated time: 30 minutes

2. **REQUIRED:** Set environment variables
   - Frontend: `VITE_API_URL`
   - Backend: `DATABASE_URL`, `JWT_SECRET`
   - Location: Vercel Dashboard

3. **REQUIRED:** Update CORS settings
   - File: `server/src/index.js`
   - Add production URLs

4. **RECOMMENDED:** Change admin password
   - Login and update from UI
   - Or update directly in database

5. **OPTIONAL:** Add custom domain
   - Vercel Dashboard → Domains
   - Add your domain and configure DNS

6. **OPTIONAL:** Setup monitoring
   - Vercel Analytics
   - Error tracking (Sentry)
   - Performance monitoring

---

## 💡 Code Patterns Used

### State Management
```javascript
// Language with localStorage persistence
const [language, setLanguage] = useState(() => 
  localStorage.getItem('alok_language') || detectLanguage()
);

// Update and persist
const handleLanguageChange = (newLang) => {
  setLanguage(newLang);
  localStorage.setItem('alok_language', newLang);
};
```

### Authentication
```javascript
// Store token in localStorage
localStorage.setItem('token', token);

// Send with API requests
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### API Calls
```javascript
// With error handling
try {
  const response = await fetch(`${API_URL}/endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) throw new Error('API error');
  
  const result = await response.json();
  return result;
} catch (error) {
  console.error('Error:', error);
  alert('Operation failed');
}
```

---

## 🔗 Important Links

- **Frontend Live:** https://codespaces-react-rho-ashen.vercel.app
- **Backend Live:** https://server-tan-iota-18.vercel.app
- **Vercel Dashboard:** https://vercel.com/preetam-yadavs-projects
- **MyMemory API:** https://mymemory.translated.net/doc/spec.php
- **Tesseract.js Docs:** https://tesseract.projectnaptha.com/

---

## 📞 Default Admin Credentials

```
Username: admin
Password: admin123
```

**⚠️ IMPORTANT:** Change password after first login!

---

**Document Version:** 1.0  
**Created:** February 19, 2026  
**For:** AI Agents & Developers  
**Status:** Production-Ready (after database migration)

---

## 🤖 AI Agent Instructions

If you're an AI agent reading this:

1. **Understand the context:**
   - This is a deployed news portal
   - Frontend and backend are live on Vercel
   - Database migration is pending (critical issue)

2. **Priority tasks:**
   - Complete PostgreSQL migration first
   - Set environment variables
   - Update CORS settings

3. **Before making changes:**
   - Read [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for full details
   - Check [BACKEND_MIGRATION_GUIDE.md](BACKEND_MIGRATION_GUIDE.md) for database steps
   - Test locally before deploying

4. **Communication style:**
   - User speaks Hindi/English mix
   - Explain technical terms simply
   - Show commands clearly with examples

5. **Files you'll most likely edit:**
   - `server/src/db.js` (database migration)
   - `server/src/index.js` (API routes)
   - `src/App.jsx` (if adding frontend features)
   - `src/translations.js` (if adding new UI text)

Good luck! 🚀
