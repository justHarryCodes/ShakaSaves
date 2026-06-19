# Ajo — Daily Contribution Collector: Setup Guide

## Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Authentication enabled
- Cloudinary account
- SendGrid account
- Upstash Redis account

---

## 1. Environment Variables

Copy `.env.local` and fill in all values. **All keys are server-only — never use `NEXT_PUBLIC_` prefix on sensitive keys.**

### Firebase Admin

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key" — download the JSON
3. Fill in:
   - `FIREBASE_PROJECT_ID` — from the JSON (`project_id`)
   - `FIREBASE_CLIENT_EMAIL` — from the JSON (`client_email`)
   - `FIREBASE_PRIVATE_KEY` — from the JSON (`private_key`). **Important:** wrap in double quotes and keep `\n` escape sequences, e.g.:
     ```
     FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
     ```

### Firebase Auth — Enable providers

In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.

### Cloudinary

1. Sign up at cloudinary.com
2. Dashboard → API Keys
3. Fill `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### SendGrid

1. Sign up at sendgrid.com
2. Settings → API Keys → Create Key (Full Access)
3. Fill `SENDGRID_API_KEY`
4. Fill `SENDGRID_FROM_EMAIL` with your verified sender email

### Upstash Redis

1. Sign up at upstash.com → Create a Redis database
2. Details page → REST API section
3. Fill `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### App

- `NEXTAUTH_SECRET` — generate with: `openssl rand -base64 32`
- `NEXT_PUBLIC_APP_URL` — your production URL (e.g. `https://ajo.vercel.app`)

---

## 2. Firestore Setup

In Firebase Console → Firestore Database:

1. Create database in **production mode**
2. Set security rules to **deny all** client access (all reads/writes go through Admin SDK server-side):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Create the following **indexes** (or deploy via `firestore.indexes.json`):

**payment_submissions**
- `customerId ASC, submittedAt DESC`
- `status ASC, submittedAt DESC`

**contributions**
- `customerId ASC, period ASC`
- `customerId ASC, confirmedAt DESC`

**notifications**
- `recipientUid ASC, createdAt DESC`
- `recipientUid ASC, read ASC, createdAt DESC`

**withdrawals**
- `customerId ASC, requestedAt DESC`
- `status ASC, requestedAt DESC`

**audit_logs**
- `performedBy ASC, timestamp DESC`
- `targetCollection ASC, timestamp DESC`

---

## 3. Seed Admin User

After creating a Firebase Auth user for the admin (via Firebase Console or the `/register` page), run the seed script to assign the `admin` role:

```bash
# Set your admin user's Firebase UID
npx tsx scripts/seed-admin.ts <FIREBASE_UID>
```

This sets the custom claim `{ role: 'admin' }` on that user. The user must sign out and sign back in for the claim to take effect.

---

## 4. Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Admin logs in at `/login` → redirected to `/admin`
- Customers log in at `/login` → redirected to `/dashboard`
- New customers self-register at `/register`

---

## 5. Deploy to Vercel

```bash
vercel --prod
```

Add all environment variables in Vercel Dashboard → Project → Settings → Environment Variables.

**Important:** In Vercel, set `FIREBASE_PRIVATE_KEY` exactly as it appears in the downloaded JSON (with literal `\n` characters — Vercel handles the escaping).
