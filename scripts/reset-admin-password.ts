/**
 * Resets a user's password and forces them to change it on next login.
 * Usage: npx tsx scripts/reset-admin-password.ts <username> [new-password]
 *
 * If [new-password] is omitted a secure temporary one is generated and printed.
 * Requirements: at least 8 chars, one uppercase, one number.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const [, , username, suppliedPassword] = process.argv;

if (!username) {
  console.error("Usage: npx tsx scripts/reset-admin-password.ts <username> [new-password]");
  process.exit(1);
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  // Ensure at least one uppercase and one digit
  let pw = Array.from(bytes).map((b) => chars[b % chars.length]).join("");
  if (!/[A-Z]/.test(pw)) pw = "A" + pw.slice(1);
  if (!/[0-9]/.test(pw)) pw = pw.slice(0, -1) + "7";
  return pw;
}

async function resetPassword() {
  const db = admin.firestore();

  // Find credentials by username
  const snap = await db
    .collection("user_credentials")
    .where("username", "==", username.toLowerCase().trim())
    .limit(1)
    .get();

  if (snap.empty) {
    console.error(`❌ No credentials found for username "${username}"`);
    process.exit(1);
  }

  const doc  = snap.docs[0];
  const data = doc.data();
  const uid  = data.uid as string;

  const newPassword = suppliedPassword ?? generateTempPassword();

  // Validate if supplied
  if (suppliedPassword) {
    if (suppliedPassword.length < 8)   { console.error("❌ Password must be at least 8 characters"); process.exit(1); }
    if (!/[A-Z]/.test(suppliedPassword)) { console.error("❌ Password must contain at least one uppercase letter"); process.exit(1); }
    if (!/[0-9]/.test(suppliedPassword)) { console.error("❌ Password must contain at least one number"); process.exit(1); }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await doc.ref.update({
    passwordHash,
    mustChangePassword: true,
    failedAttempts:     0,
    lockedUntil:        null,
    updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`\n✅ Password reset for username: ${username} (uid: ${uid})`);
  console.log(`\n   Temporary password: ${newPassword}`);
  console.log(`\n   ⚠  They will be forced to set a new password on first login.\n`);

  process.exit(0);
}

resetPassword().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
