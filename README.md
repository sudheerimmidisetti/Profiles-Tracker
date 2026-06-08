# CPTrack — College Coding Profile Tracker

A full-stack platform that tracks student performance across LeetCode, Codeforces, CodeChef, and HackerRank. Built for college faculty to monitor coding activity and for students to view their stats and leaderboard rankings.

---

## Project Structure

```
cptrack/
├── backend/                    ← Node.js + Express API
│   ├── src/
│   │   ├── app.js              Entry: Express app + middleware
│   │   ├── server.js           HTTP server + startup
│   │   ├── config/             DB (PostgreSQL) + Redis clients
│   │   ├── jobs/               Nightly sync cron (2 AM IST)
│   │   ├── middleware/         JWT auth + admin secret guard
│   │   ├── migrations/         PostgreSQL schema (run once)
│   │   ├── modules/            Feature modules:
│   │   │   ├── auth/           OTP register + login
│   │   │   ├── profile/        Student profile + settings
│   │   │   ├── handlers/       Platform handle verification
│   │   │   ├── leaderboard/    Rankings by platform + filter
│   │   │   ├── analytics/      Charts + daily snapshots
│   │   │   └── admin/          Admin dashboard API
│   │   ├── scrapers/           LeetCode / CF / CodeChef / HackerRank
│   │   └── utils/              Logger, mailer, token generator
│   ├── .env.example            Copy → .env and fill in secrets
│   ├── package.json
│   └── Procfile
│
├── frontend/
│   ├── student/                ← React app → tracker.dealance.app
│   │   └── src/
│   │       ├── pages/          Login, Dashboard, Leaderboard, Analytics, Profile
│   │       ├── components/     KPI cards, Platform cards, Charts, Heatmap
│   │       ├── context/        Auth context + token refresh
│   │       └── api/            Axios instance with interceptors
│   └── admin/                  ← React app → admin.dealance.app
│       └── src/
│           ├── pages/          Overview, Students, Detail, Leaderboard, Analytics
│           ├── components/     Tables, Charts, Admin-specific UI
│           └── context/        Admin secret auth
│
├── nginx.conf                  EC2 Nginx reverse proxy config
├── setup-ec2.sh                One-shot Ubuntu 22.04 bootstrap
└── package.json                Root scripts (run all at once)
```

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 15
- Redis 7

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/cptrack.git
cd cptrack
npm run install:all
```

### 2. Set Up Backend

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your DB, Redis, SMTP credentials

# Run migrations (creates all tables)
npm run migrate

# Optional: start mock college DB (for testing registration)
npm run dev:mock
```

### 3. Start Everything

```bash
npm run dev          # starts backend + student + admin concurrently
```

| Service | URL |
|---|---|
| Backend API | http://localhost:3000 |
| Student Portal | http://localhost:5173 |
| Admin Dashboard | http://localhost:5174 |
| Mock College DB | http://localhost:4000 |

---

## Backend API Reference

Base URL: `https://api.dealance.app` (production) / `http://localhost:3000` (dev)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Send OTP to college email |
| `POST` | `/api/auth/verify-otp` | — | Verify OTP → get tokens |
| `POST` | `/api/auth/refresh` | — | Refresh access token |
| `POST` | `/api/auth/logout` | JWT | Invalidate session |
| `GET` | `/api/profile/me` | JWT | Get full student profile |
| `PUT` | `/api/profile/settings` | JWT | Update phone/branch |
| `POST` | `/api/handlers/submit` | JWT | Submit platform handles |
| `GET` | `/api/handlers/verify-status` | JWT | Get verification code |
| `POST` | `/api/handlers/confirm` | JWT | Run verification check |
| `GET` | `/api/leaderboard/:platform` | JWT | Leaderboard (all/contest/consistency/problems) |
| `GET` | `/api/analytics/snapshot/:email` | JWT | Daily rating history |
| `GET` | `/api/analytics/summary/:email` | JWT | Cross-platform summary |
| `GET` | `/api/admin/students` | Admin | List all students |
| `PUT` | `/api/admin/blocklist/:email` | Admin | Block student |
| `PUT` | `/api/admin/unblocklist/:email` | Admin | Unblock student |
| `POST` | `/api/admin/sync` | Admin | Trigger manual data sync |
| `GET` | `/health` | — | Health check |

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for all required variables.

Key ones:
```
DATABASE_URL=postgresql://cptrack:password@localhost:5432/coding_tracker
REDIS_URL=redis://localhost:6379
JWT_SECRET=<96-char hex>
SMTP_HOST=email-smtp.ap-south-1.amazonaws.com
FROM_EMAIL=noreply@dealance.app
COLLEGE_EMAIL_DOMAINS=@acet.ac.in,@aec.edu.in,@adityauniversity.in
ADMIN_SECRET=<strong secret — share with faculty only>
CORS_ORIGIN=https://tracker.dealance.app,https://admin.dealance.app
```

---

## Deployment (Cloudflare + AWS EC2)

| Service | URL | Hosting |
|---|---|---|
| Backend API | `api.dealance.app` | AWS EC2 t2.micro + Nginx |
| Student Portal | `tracker.dealance.app` | Cloudflare Pages (free) |
| Admin Dashboard | `admin.dealance.app` | Cloudflare Pages (free) |
| Email | `noreply@dealance.app` | AWS SES |

### Deploy Backend

```bash
# On EC2 (Ubuntu 22.04):
git clone https://github.com/YOUR_USERNAME/cptrack.git
cd cptrack
./setup-ec2.sh

# Then:
cp backend/.env.example backend/.env && nano backend/.env
cd backend && npm run migrate
pm2 start src/server.js --name cptrack-api
pm2 save
```

### Deploy Frontends

Cloudflare Pages settings:

| App | Root Directory | Build Command | Output | Env Var |
|---|---|---|---|---|
| Student | `frontend/student` | `npm run build` | `dist` | `VITE_API_URL=https://api.dealance.app` |
| Admin | `frontend/admin` | `npm run build` | `dist` | `VITE_API_URL=https://api.dealance.app` |

---

## How the Handle Verification Flow Works

```
1. Student submits handles (LC/CF/CC/HR)
2. Backend generates a 8-char code (e.g. "QH1HDENK")
3. Student sets their FIRST NAME on each platform to that code
4. Student clicks "Verify" → backend scrapes each platform's display name
5. If first word of display name = code → verified ✅
6. Verification triggers immediate background sync
7. Dashboard populates with real data within ~30 seconds
8. Nightly cron (2 AM IST) keeps data fresh every day
```

---

## Admin Access

There is no admin registration — it uses a shared secret:
1. Set `ADMIN_SECRET=your_secret` in `backend/.env`
2. Open `admin.dealance.app/login`
3. Enter the secret
4. Share the secret with faculty via secure channel (not email/chat)
