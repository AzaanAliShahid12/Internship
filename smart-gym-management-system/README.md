# Smart Gym Management System

A complete, production-quality gym management platform with **QR code check-in** and
**AI-based face recognition**, role-based dashboards for admins, receptionists,
trainers and members, memberships, payments, attendance, reports and real-time
updates — all backed by a real MongoDB database. No mock data, no dummy buttons.

## Live Demo

- **Website (frontend):** https://internship-weconnect1.vercel.app
- **Backend API:** https://internship-production-c84dac16.up.railway.app

Open the website and log in with any demo account listed below, or use
"Create an account" on the login page to sign up as a new member.

## Highlights

- **Two entrance methods** — unique revocable QR credentials (random token, SHA-256
  hashed at rest) and real face recognition (face-api.js / TensorFlow.js in the
  browser, server-side matching against AES-256-GCM-encrypted templates).
- **One check-in pipeline** — QR, face and manual entry all run the same eligibility
  checks: account active, membership active & unexpired, no duplicate active session.
- **Real-time** — Socket.IO pushes check-ins, rejections, occupancy and notifications
  to staff dashboards instantly, scoped by role.
- **Full management** — members, trainers, plans, memberships & renewals, payments
  with receipts, notifications, audit log, entrance devices, CSV exports, print views.
- **Security** — bcrypt passwords, JWT access tokens + rotating refresh tokens with
  reuse detection, RBAC on every route, Zod validation, Helmet, CORS, rate limiting,
  audit logging, biometric consent + deletion, descriptors never exposed by the API.
- **Tested** — 29 backend integration tests (Vitest + Supertest + in-memory MongoDB)
  covering auth, RBAC, members, QR flows, face matching, attendance and payments.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn-style components, React Router, TanStack Query, React Hook Form + Zod, Recharts, Axios, Socket.IO client |
| Backend | Node.js, Express, TypeScript, Mongoose, JWT, bcrypt, Zod, Multer, Socket.IO |
| Database | MongoDB |
| QR | `qrcode` (generation), `html5-qrcode` (camera scanning) |
| Face AI | `@vladmandic/face-api` (TensorFlow.js): TinyFaceDetector + 68-point landmarks + 128-d recognition descriptors, Euclidean matching |

## Project structure

```
gym-management-system/
├── client/            React frontend (28 pages, design system in src/components/ui)
│   └── public/models/ face-api.js weights (copied automatically on install)
├── server/            Express API (controllers / services / models / routes / sockets)
│   └── tests/         Vitest integration tests
├── docs/              database-design.md · api-documentation.md · setup-guide.md
├── .env.example
└── package.json       convenience scripts (install:all, dev:server, dev:client, seed, test)
```

## Quick start

```bash
npm run install:all          # install everything (face models copy automatically)
cp .env.example server/.env  # then edit secrets + MongoDB URI
npm run seed                 # demo data + demo accounts (see docs/setup-guide.md)
npm run dev:server           # http://localhost:5000
npm run dev:client           # http://localhost:5173
```

Full instructions — including Atlas, production builds and deploying the frontend
to Vercel and the API to Render — are in **[docs/setup-guide.md](docs/setup-guide.md)**.
API reference: **[docs/api-documentation.md](docs/api-documentation.md)** ·
Database design: **[docs/database-design.md](docs/database-design.md)**.

## Demo accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@gym.com | Admin@123 |
| Gym Admin | admin@gym.com | Admin@123 |
| Receptionist | reception@gym.com | Staff@123 |
| Trainer | trainer@gym.com | Trainer@123 |
| Member | member@gym.com | Member@123 |

## Honest limitations

- Blink-based liveness is a basic anti-spoofing aid, not certified liveness.
- Password-reset email delivery needs an email provider in production
  (the token flow itself is fully implemented; dev mode returns the token for testing).
- Face matching quality depends on camera and lighting; the threshold is configurable.
