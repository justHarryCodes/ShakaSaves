/**
 * Production database wipe.
 *
 * Keeps:
 *   - Faith's customer record + all her linked documents
 *   - Admin user_credentials (shakasaves, shakasave, glitch2024)
 *   - admin_settings, savings_plans  (config, not user data)
 *
 * Deletes from Firestore:
 *   - All other customers + their savings_cards, payment_submissions,
 *     contributions, withdrawals, notifications, push_subscriptions,
 *     card_requests, contribution_update_requests
 *   - All migration_import_requests and audit_logs
 *
 * Deletes from Firebase Auth:
 *   - Every Firebase user whose uid is NOT Faith's and NOT an admin
 *
 * Usage:
 *   npx tsx scripts/wipe-for-production.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";

const ADMIN_USERNAMES = new Set(["shakasaves", "shakasave", "glitch2024"]);

const ABORT_SECONDS = 5;

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

const db   = admin.firestore();
const auth = admin.auth();

async function deleteCollection(colName: string, excludeIds: Set<string> = new Set()) {
  const snap = await db.collection(colName).get();
  const toDelete = snap.docs.filter((d) => !excludeIds.has(d.id));
  if (toDelete.length === 0) { console.log(`  ✓  ${colName}: nothing to delete`); return 0; }

  // Batch in groups of 400
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += toDelete.slice(i, i + 400).length;
  }
  console.log(`  🗑  ${colName}: deleted ${deleted} doc(s)`);
  return deleted;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  // ── 1. Find Faith ─────────────────────────────────────────────────────────
  const customersSnap = await db.collection("customers").get();
  const faithDoc = customersSnap.docs.find((d) => {
    const name: string = (d.data().fullName ?? "").toLowerCase();
    return name.includes("faith");
  });

  if (!faithDoc) {
    console.error('\n❌  Could not find a customer named "Faith". Aborting.\n');
    process.exit(1);
  }

  const faithCustomerId = faithDoc.id;
  const faithUid        = faithDoc.data().uid as string;

  console.log(`\n✅  Found Faith:`);
  console.log(`     Customer ID : ${faithCustomerId}`);
  console.log(`     Firebase UID: ${faithUid}`);
  console.log(`     Name        : ${faithDoc.data().fullName}`);

  // ── 2. Find admin credential docs (by username) ───────────────────────────
  const credsSnap = await db.collection("user_credentials").get();
  const adminCredIds = new Set(
    credsSnap.docs
      .filter((d) => ADMIN_USERNAMES.has((d.data().username as string ?? "").toLowerCase()))
      .map((d) => d.id)
  );

  // Also keep Faith's credential doc (keyed by uid)
  const keepCredIds = new Set([...adminCredIds, faithUid]);

  // Admin Firebase UIDs (the uid is the doc id for user_credentials)
  const adminUids = new Set([...adminCredIds]);

  console.log(`\n  Admin credential docs to keep: ${[...adminCredIds].join(", ") || "(none found)"}`);
  console.log(`  Faith's UID to keep          : ${faithUid}\n`);

  // ── 3. Preview ────────────────────────────────────────────────────────────
  const otherCustomers = customersSnap.docs.filter((d) => d.id !== faithCustomerId);
  const otherUids = new Set(otherCustomers.map((d) => d.data().uid as string).filter(Boolean));

  console.log(`  Customers to DELETE : ${otherCustomers.length}`);
  otherCustomers.forEach((d) => {
    console.log(`    - ${d.id} (${d.data().fullName})`);
  });

  // ── 4. Abort window ───────────────────────────────────────────────────────
  console.log(`\n⚠️  This will permanently delete all data except Faith and admins.`);
  console.log(`   Proceeding in ${ABORT_SECONDS} seconds — Ctrl+C to abort...\n`);
  await sleep(ABORT_SECONDS * 1000);

  // ── 5. Wipe Firestore ─────────────────────────────────────────────────────
  console.log("Wiping Firestore...\n");

  // Collections that are entirely per-user and can be filtered by customerId/uid
  // Delete docs not belonging to Faith
  for (const col of [
    "savings_cards",
    "payment_submissions",
    "contributions",
    "withdrawals",
    "card_requests",
    "contribution_update_requests",
    "notifications",
    "push_subscriptions",
  ]) {
    const snap = await db.collection(col).get();
    const toDelete = snap.docs.filter((d) => {
      const cid: string = d.data().customerId ?? d.data().uid ?? "";
      return cid !== faithCustomerId && cid !== faithUid;
    });
    if (toDelete.length === 0) { console.log(`  ✓  ${col}: nothing to delete`); continue; }
    for (let i = 0; i < toDelete.length; i += 400) {
      const batch = db.batch();
      toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    console.log(`  🗑  ${col}: deleted ${toDelete.length} doc(s)`);
  }

  // customers — keep Faith
  await deleteCollection("customers", new Set([faithCustomerId]));

  // user_credentials — keep admins + Faith
  await deleteCollection("user_credentials", keepCredIds);

  // Bulk-delete collections with no keep
  await deleteCollection("migration_import_requests");
  await deleteCollection("audit_logs");

  // ── 6. Wipe Firebase Auth users ───────────────────────────────────────────
  console.log("\nWiping Firebase Auth users...\n");

  let pageToken: string | undefined;
  let authDeleted = 0;
  const uidsToDelete: string[] = [];

  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const u of result.users) {
      if (u.uid === faithUid || adminUids.has(u.uid)) continue;
      uidsToDelete.push(u.uid);
    }
    pageToken = result.pageToken;
  } while (pageToken);

  // deleteUsers supports up to 1000 at a time
  for (let i = 0; i < uidsToDelete.length; i += 1000) {
    const chunk = uidsToDelete.slice(i, i + 1000);
    await auth.deleteUsers(chunk);
    authDeleted += chunk.length;
  }

  console.log(`  🗑  Firebase Auth: deleted ${authDeleted} user(s)`);

  console.log(`\n✅  Done. Database is clean. Faith (${faithDoc.data().fullName}) is ready for production.\n`);
  process.exit(0);
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
