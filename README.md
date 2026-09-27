# BloodLink API

Backend for an emergency blood donation platform. Patients publish a blood request, pay a coordination fee with bKash, an admin verifies the request, and a compatible donor accepts it. Two donors cannot accept the same request.

Student ID: L2B7-0722

## Roles

| Role | Can do |
| --- | --- |
| Patient | Register, manage profile, create and pay for blood requests, cancel own requests |
| Donor | Register with blood group, set availability, accept a compatible verified request, complete the donation |
| Admin | Verify or reject requests, manage users, read dashboard stats and audit logs |

A donor must wait 90 days after a completed donation. Acceptance uses a database transaction so only one donor can lock a verified request.

## Stack

Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod, JWT, Google ID token login, bKash sandbox, Helmet, express-rate-limit.

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

API base: `http://localhost:8080/api/v1`

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@bloodlink.com | Admin@12345 |
| Patient | patient@bloodlink.com | Patient@12345 |
| Donor | donor@bloodlink.com | Donor@12345 |
| Donor O- | donor.onega@bloodlink.com | Donor@12345 |
| Donor A+ (Chattogram) | donor.chattogram@bloodlink.com | Donor@12345 |
| Donor in cooldown | donor.cooldown@bloodlink.com | Donor@12345 |

The patient account already has one verified request at Dhaka Medical College Hospital, so a compatible donor can accept it without a new payment.

## Response shape

Success:

```json
{ "success": true, "message": "Operation successful", "data": {} }
```

Error:

```json
{ "success": false, "message": "Something went wrong", "errors": [] }
```

List endpoints also return `meta` with `page`, `limit`, `total`, and `totalPages`.

## Main flow

1. Patient `POST /api/v1/blood-requests` creates a request in `PENDING_PAYMENT`.
2. Patient `POST /api/v1/payments/initiate` receives a bKash URL.
3. After payment, bKash calls `GET /api/v1/payments/callback` and the request becomes `OPEN`.
4. Admin `PATCH /api/v1/blood-requests/:id/verify` moves it to `VERIFIED`.
5. A compatible available donor `POST /api/v1/blood-requests/:id/accept`.
6. That donor `POST /api/v1/blood-requests/:id/complete`. The donor then enters a 90-day cooldown.

Password reset works without email in development. `POST /api/v1/auth/forgot-password` returns `resetToken` when `NODE_ENV=development`.

Google login expects a Google ID token in `{ "idToken": "..." }`.

Local API port is **8080** because macOS often reserves port 5000 for AirPlay. In Google Cloud, add `http://localhost:8080` as a JavaScript origin and `http://localhost:8080/api/v1/auth/google/callback` as a redirect URI.

## Scripts

```bash
npm run dev
npm run build
npm start
npm run db:studio
```

Postman collection: `BloodLink.postman_collection.json`
