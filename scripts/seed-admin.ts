/**
 * Sets the 'admin' custom claim on a Firebase Auth user.
 * Usage: npx tsx scripts/seed-admin.ts <FIREBASE_USER_UID>
 *
 * Run this once after creating the admin user account in Firebase Console
 * or via the /register page. The user must sign out and back in for the
 * new claim to take effect.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";

const uid = process.argv[2];

if (!uid) {
  console.error("Usage: npx tsx scripts/seed-admin.ts <FIREBASE_USER_UID>");
  process.exit(1);
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

async function setAdminRole() {
  try {
    await admin.auth().setCustomUserClaims(uid, { role: "admin" });
    const user = await admin.auth().getUser(uid);
    console.log(`✅ Admin role set successfully for: ${user.email} (${uid})`);
    console.log("   The user must sign out and sign back in for the claim to take effect.");
  } catch (err) {
    console.error("❌ Failed to set admin role:", err);
    process.exit(1);
  }
  process.exit(0);
}

setAdminRole();
