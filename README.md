# ALOK — BJMC UG News Platform

ALOK एक हाई-टेक, फ्यूचर-रेडी न्यूज़ वेबसाइट है जो BJMC UG स्टूडेंट के लिए डिज़ाइन की गई है। इसमें एडमिन पैनल, न्यूज CRUD, समरी, वीडियो सेक्शन, टाइमलाइन और डेटा-ड्रिवन फीचर्स शामिल हैं।

## Quick Start

### Frontend
```
npm install
npm start
```

### Backend
```
cd server
npm install
npm run dev
```

## Default Admin (Primary Only)
- Email: `vipno1official@gmail.com`
- Password: `preetam6388`
- Note: Only primary admin (id=1) is allowed to log in.

## Documentation
- Detailed guide: [docs/ALOK-DOCS.md](docs/ALOK-DOCS.md)

## Dev Notes
- Vite proxy `/api` and `/uploads` to `http://localhost:4000`.
- Update environment values using [server/.env.example](server/.env.example).
- Frontend uses same-origin API by default; set `VITE_API_URL` for custom backend URL.
