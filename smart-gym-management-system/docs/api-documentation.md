# API Documentation — Smart Gym Management System

Base URL: `http://localhost:5000/api`
All responses use the envelope: `{ "success": true, "data": ... }` or
`{ "success": false, "message": "..." }`.
Authentication: `Authorization: Bearer <accessToken>` (15-minute JWT). The refresh
token is an HttpOnly cookie set by login/register and rotated by `POST /auth/refresh`.
List endpoints accept `page` and `limit` and return
`{ items, total, page, limit, totalPages }`.

## Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /auth/register | Public | Self-registration (always member role) |
| POST | /auth/login | Public | Login, sets refresh cookie |
| POST | /auth/refresh | Cookie | Rotate refresh token, get new access token |
| POST | /auth/logout | Logged in | Revoke current refresh token |
| POST | /auth/forgot-password | Public | Start password reset (token emailed in production; returned in dev) |
| POST | /auth/reset-password | Public | Complete reset with token |
| GET | /auth/me | Logged in | Current user |
| PUT | /auth/profile | Logged in | Update display name |
| POST | /auth/change-password | Logged in | Change password (verifies current) |

## Users (Super Admin / Gym Admin)
| Method | Endpoint | Description |
|---|---|---|
| GET | /users | List/search/filter by role |
| POST | /users | Create account with any role |
| PUT | /users/:id | Update name/role/status |
| DELETE | /users/:id | Deactivate account |

## Members
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | /members | Staff, Trainer | List with search, status, plan, trainer filters |
| GET | /members/export/csv | Staff | CSV export |
| GET | /members/:id | Staff, Trainer, own | Details incl. current membership |
| POST | /members | Admin, Receptionist | Create member (multipart photo supported) |
| PUT | /members/:id | Admin, Receptionist | Update member |
| DELETE | /members/:id | Admins | Deactivate member |
| GET | /members/:id/attendance | Staff, Trainer | Member attendance history |
| GET | /members/:id/payments | Staff | Member payment history |

## Membership Plans
| Method | Endpoint | Access |
|---|---|---|
| GET | /plans | Any logged-in user (`?status=active`) |
| POST / PUT / DELETE | /plans, /plans/:id | Admins (delete blocked while in use) |

## Memberships
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | /memberships | Staff | Current memberships with status filter |
| GET | /memberships/upcoming-renewals?days=7 | Staff | Expiring soon |
| POST | /memberships | Staff | Assign/change plan (closes previous) |
| PUT | /memberships/:id | Staff | Suspend/reactivate, adjust expiry |
| POST | /memberships/:id/renew | Staff | Extend by the plan duration |

## QR Codes
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /qr/generate/:memberId | Staff | Create credential (revokes old). Returns raw token once + QR image |
| POST | /qr/revoke/:memberId | Staff | Revoke active credential |
| GET | /qr/status/:memberId | Staff | Credential + eligibility status |
| POST | /qr/verify | Staff | Entrance verification `{ token, deviceId? }` → `{ allowed, reason?, member, plan, expiryDate, checkInAt }` |

## Face Recognition
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /face/enroll | Staff | `{ memberId, consent: true, samples: number[128][] }` (3–10 samples) |
| POST | /face/verify | Staff | `{ descriptor: number[128], deviceId? }` → same result shape as QR verify |
| GET | /face/status/:memberId | Staff, own member | Enrollment status (never returns descriptors) |
| DELETE | /face/:memberId | Staff, own member | Delete biometric data (consent withdrawal) |

## Attendance
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /attendance/check-in | Staff | Manual check-in `{ memberId }` |
| POST | /attendance/check-out | Staff | Check out `{ memberId }` |
| GET | /attendance | Staff, Trainer | Filter by date/from/to/method/result/member/search |
| GET | /attendance/today | Staff | Today's successful check-ins + occupancy + rejected count |
| GET | /attendance/occupancy | Staff | Who is inside right now |
| GET | /attendance/export/csv | Staff | CSV export |
| GET | /attendance/member/:memberId | Staff, Trainer | Per-member history |

## Trainers
| Method | Endpoint | Access |
|---|---|---|
| GET | /trainers | Staff, Trainer (salary only for admins) |
| GET | /trainers/:id | Staff, Trainer — includes assigned members |
| POST / PUT / DELETE | /trainers, /trainers/:id | Admins |
| POST | /trainers/:id/assign-member | Staff |
| GET | /trainers/me/members | Trainer — own profile + assigned members |

## Payments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | /payments | Staff | Filter by status/method/member/date |
| POST | /payments | Staff | Record payment (pending unless explicitly confirmed completed) |
| GET | /payments/:id | Staff | Payment details |
| PUT | /payments/:id/status | Staff | Confirm/complete, fail or refund |
| GET | /payments/:id/receipt | Staff | Printable receipt data |

## Dashboard & Reports
| Method | Endpoint | Access |
|---|---|---|
| GET | /dashboard/stats | Staff — headline stats + recent activity |
| GET | /dashboard/attendance?days=30 | Staff — daily series with method split |
| GET | /dashboard/revenue?months=6 | Staff — monthly revenue + plan distribution |
| GET | /reports/attendance | Staff — daily totals incl. rejected + method split |
| GET | /reports/revenue | Staff — totals by method and status |
| GET | /reports/memberships | Staff — status counts + by plan |
| GET | /reports/rejected | Staff — rejection reasons |
| GET | /reports/occupancy | Staff — daily check-ins + unique members |
| GET | /reports/registrations | Staff — new members per day |

## Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET | /notifications | Visible notifications for the caller (+ `unread` count) |
| PUT | /notifications/:id/read | Mark one as read |
| PUT | /notifications/read-all | Mark all as read |

## Devices & Audit (Admins)
| Method | Endpoint |
|---|---|
| GET / POST / PUT / DELETE | /devices, /devices/:id |
| GET | /audit-logs |

## Member Portal (`/me`, member role only)
| Method | Endpoint | Description |
|---|---|---|
| GET / PUT | /me/profile | Own member profile |
| GET | /me/qr | Own QR image (rendered server-side from the encrypted token) |
| GET | /me/attendance | Own visits + stats |
| GET | /me/payments | Own payments |
| GET | /me/membership | Own membership + remaining days |
| POST | /me/renewal-request | Notify staff of a renewal request |

## Real-time (Socket.IO)
Connect with `auth: { token: <accessToken> }`. Rooms are role-scoped:
staff join `staff`, trainers join `trainers`, everyone joins `user:<id>`.
Events: `attendance:checkin`, `attendance:checkout`, `attendance:rejected`,
`dashboard:refresh`, `notification:new`.
