# Shaka Saves

**Discipline · Save · Grow · Financial Freedom**

A digital platform for running an *ajo* (daily contribution) savings scheme. Customers save small amounts daily toward savings plans on contribution cards. Admins record payments, approve withdrawals and track every naira from one dashboard, replacing paper cards and spreadsheets.

## Features

**Customers**
- Register, sign in and manage their account securely
- View their contribution cards, balances and savings progress
- Make payments, see full payment history and request withdrawals
- Request new cards, get in-app and push notifications, and install the site as a PWA

**Admins**
- Manage customers, contribution cards and savings plans
- Record and verify payments and contribution updates
- Review and approve withdrawals
- Analytics dashboards and downloadable PDF and Excel reports
- Manage staff users, notifications and platform settings
- Migrate existing paper and spreadsheet records onto digital cards, with a preview first
- An audit log of sensitive actions

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) with React and TypeScript |
| UI | Tailwind CSS, shadcn/ui, Recharts, Sonner |
| Auth | Firebase Authentication with role-based custom claims (`admin`) |
| Database | Cloud Firestore, accessed only through the Admin SDK on the server |
| Rate limiting | Upstash Redis |
| Email | Resend |
| Media | Cloudinary |
| Reports | `@react-pdf/renderer`, `xlsx` |
| Notifications | Web Push |
| Validation | Zod |

## Getting started

```bash
git clone https://github.com/justHarryCodes/ShakaSaves.git
cd ShakaSaves
npm install
# create .env.local (see below)
npm run dev          # http://localhost:3000
```

Then make your first admin:

```bash
npx tsx scripts/seed-admin.ts <FIREBASE_USER_UID>
```

The full walkthrough, covering Firebase providers, Firestore rules and indexes, and deployment, is in the **[setup guide](docs/SETUP.md)**.

## Environment variables

| Group | Variables |
|---|---|
| Firebase Admin | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Firebase client | `NEXT_PUBLIC_FIREBASE_*` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| App | `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_SECRET` |

## Security model

- Firestore security rules deny **all** client access. Every read and write goes through server API routes using the Admin SDK.
- Roles are Firebase custom claims, checked in `middleware.ts` and in every admin route.
- Sensitive endpoints are rate-limited with Upstash Redis.
- Admin actions are written to an audit log.

## Project structure

```
app/
├── (auth)/          # Login, register, forgot/change password
├── dashboard/       # Customer area: cards, pay, history, withdraw, notifications
├── admin/           # Admin area: customers, cards, payments, withdrawals, reports, …
└── api/v1/          # Versioned REST API used by both areas
components/          # admin, shared and ui (shadcn) components
lib/                 # Firestore data access, auth, PDF reports, notifications, utils
schemas/             # Zod schemas for customers, payments, withdrawals, settings
scripts/             # Admin seeding and data maintenance scripts
docs/SETUP.md        # Full setup and deployment guide
```

## Deployment

Deploy on Vercel (configured in `vercel.json`) and add the environment variables in the project settings. See [docs/SETUP.md](docs/SETUP.md#5-deploy-to-vercel).
