# Setup & Deployment Guide

## Prerequisites

- **Node.js 18+** (20+ recommended) and npm
- **MongoDB** — any one of:
  - Local: install MongoDB Community Server, or run `docker run -d -p 27017:27017 mongo`
  - Cloud (free): [MongoDB Atlas](https://www.mongodb.com/atlas) — create a cluster and copy its connection string
- A modern browser with a camera for the QR / face entrance screens

## 1. Install dependencies

From the project root:

```bash
npm run install:all
```

This installs the root, `server/` and `client/` packages. The client's postinstall
copies the face-api.js model weights into `client/public/models/` automatically.

## 2. Configure environment

```bash
cp .env.example server/.env   # server reads server/.env (or root .env)
```

Edit the values:

| Variable | Notes |
|---|---|
| `MONGODB_URI` | e.g. `mongodb://127.0.0.1:27017/gym-management-system` or your Atlas string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Long random strings — change before production |
| `BIOMETRIC_ENCRYPTION_KEY` | 32-byte key (64 hex chars). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Keep it forever** — changing it makes stored face templates unreadable |
| `FACE_MATCH_THRESHOLD` | Euclidean distance threshold for face matching (default `0.6`; lower = stricter) |
| `CLIENT_URL` | The frontend origin, for CORS (default `http://localhost:5173`) |
| `VITE_API_URL` / `VITE_SOCKET_URL` | Set in `client/.env` when the API is not on localhost:5000 |

## 3. Seed demo data

```bash
npm run seed
```

Creates 6 plans, a trainer, 3 members (one with an expired membership), payments,
QR credentials and entrance devices, plus these demo logins:

| Email | Password | Role |
|---|---|---|
| superadmin@gym.com | Admin@123 | Super Admin |
| admin@gym.com | Admin@123 | Gym Admin |
| reception@gym.com | Staff@123 | Receptionist |
| trainer@gym.com | Trainer@123 | Trainer |
| member@gym.com | Member@123 | Member (Ahmed Khan) |

⚠️ Change or delete these accounts before any real deployment.

## 4. Run in development

Two terminals:

```bash
npm run dev:server   # API + Socket.IO on http://localhost:5000
npm run dev:client   # Web app on http://localhost:5173
```

## 5. Run the tests

```bash
npm test
```

Backend integration tests (Vitest + Supertest) run against an in-memory MongoDB —
no local database needed. They cover auth/refresh rotation, RBAC, member CRUD,
QR verification (valid / invalid / revoked / expired / suspended / duplicate),
face enrollment + matching + unknown-face rejection + biometric deletion,
attendance sessions, payments and revenue reporting.

## 6. Production build

```bash
npm run build          # builds server (dist/) and client (dist/)
npm --prefix server run start   # serve the API from server/dist
```

Serve `client/dist` with any static host or reverse proxy.

## 7. Deployment (typical free-tier setup)

- **Database:** MongoDB Atlas (free M0 cluster). Put its URI in the server env.
- **Backend:** Render / Railway — root directory `server`, build `npm install && npm run build`,
  start `npm run start`. Set all server env variables, including `CLIENT_URL` = your frontend URL.
- **Frontend:** Vercel / Netlify — root directory `client`, build `npm run build`, output `dist`.
  Set `VITE_API_URL` and `VITE_SOCKET_URL` to the backend URL.
- **GitHub:** push the whole folder; `.env` files are git-ignored — never commit real secrets.

## 8. Camera & face recognition notes

- Browsers only allow camera access on **HTTPS** or **localhost** — deploy the
  frontend over HTTPS (Vercel/Render provide it) for entrance devices.
- Face models (~7 MB) load once from `/models` and are cached by the browser.
- Enrollment needs good light and 3–10 samples; the server stores one averaged,
  AES-256-GCM-encrypted template per member. No photos are stored anywhere.
- The blink liveness challenge is a basic anti-spoofing aid (helps against printed
  photos). It is **not** certified liveness detection — for high-security sites,
  pair it with staff supervision at the entrance.
- If matching is too strict/lenient in your lighting conditions, tune
  `FACE_MATCH_THRESHOLD` (0.5 stricter, 0.65 more lenient) and restart the server.

## 9. Password reset emails

The forgot-password flow creates a real, expiring reset token. In development the
token is returned in the API response so the flow can be tested end-to-end without
an email provider. In production (`NODE_ENV=production`) the token is **not**
returned — connect an email provider (SMTP/Resend/SendGrid) in
`server/src/controllers/authController.ts` (`forgotPassword`) to deliver it.

## Troubleshooting

| Problem | Fix |
|---|---|
| `MongooseServerSelectionError` | MongoDB is not running / wrong `MONGODB_URI` |
| Camera will not start | Use HTTPS or localhost; allow camera permission; close other apps using the camera |
| Face models 404 | Run `npm --prefix client run postinstall` to copy weights into `public/models` |
| CORS errors | `CLIENT_URL` on the server must exactly match the frontend origin |
| Face verify always "unknown" | Re-enroll in better light, or raise `FACE_MATCH_THRESHOLD` slightly |
