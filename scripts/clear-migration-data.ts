/**
 * Clears all migration data from Firestore for retesting.
 *
 * What this does:
 *   1. Finds all savings_cards where migrated == true
 *   2. Subtracts each card's currentBalance from its owner's customer balance
 *   3. Deletes those migrated savings cards
 *   4. Deletes all migration_import_requests (all statuses)
 *
 * Audit logs are NOT touched (they are immutable by design).
 *
 * Usage:
 *   npx tsx scripts/clear-migration-data.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";

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

async function run() {
  const db = admin.firestore();

  // ── 1. Fetch migrated cards ─────────────────────────────────────────
  const cardsSnap = await db
    .collection("savings_cards")
    .where("migrated", "==", true)
    .get();

  // ── 2. Fetch all migration requests ────────────────────────────────
  const requestsSnap = await db.collection("migration_import_requests").get();

  if (cardsSnap.empty && requestsSnap.empty) {
    console.log("Nothing to clear — no migrated cards or migration requests found.");
    process.exit(0);
  }

  console.log(`\nFound ${cardsSnap.size} migrated card(s) and ${requestsSnap.size} migration request(s).\n`);

  // ── 3. Build per-customer balance reversal map ──────────────────────
  const balanceReversal = new Map<string, number>(); // customerId → total to subtract

  for (const doc of cardsSnap.docs) {
    const data = doc.data();
    const customerId = data.customerId as string | undefined;
    const balance    = (data.currentBalance as number) ?? 0;
    const cardName   = data.cardName ?? doc.id;

    console.log(`  Card: ${doc.id} (${cardName}) — customerId: ${customerId ?? "?"} — balance: ₦${balance.toLocaleString()}`);

    if (customerId && balance > 0) {
      balanceReversal.set(customerId, (balanceReversal.get(customerId) ?? 0) + balance);
    }
  }

  console.log(`\n  Customers to adjust: ${balanceReversal.size}`);
  for (const [cid, amt] of balanceReversal) {
    console.log(`    ${cid} → -₦${amt.toLocaleString()}`);
  }

  console.log(`\n  Migration requests to delete: ${requestsSnap.size}`);
  for (const doc of requestsSnap.docs) {
    const d = doc.data();
    console.log(`    ${doc.id} — code: ${d.migrationCode ?? "?"} — status: ${d.status ?? "?"}`);
  }

  console.log("\n⚠  Proceeding in 3 seconds — Ctrl+C to abort...");
  await new Promise((r) => setTimeout(r, 3000));

  // ── 4. Execute in batches (Firestore max 500 ops per batch) ────────
  let totalOps = 0;
  const MAX_OPS = 490;

  function newBatch() { return db.batch(); }
  let batch = newBatch();

  async function flushIfNeeded(force = false) {
    if (totalOps >= MAX_OPS || force) {
      await batch.commit();
      batch = newBatch();
      totalOps = 0;
    }
  }

  // Delete migrated cards
  for (const doc of cardsSnap.docs) {
    batch.delete(doc.ref);
    totalOps++;
    await flushIfNeeded();
  }

  // Delete migration requests
  for (const doc of requestsSnap.docs) {
    batch.delete(doc.ref);
    totalOps++;
    await flushIfNeeded();
  }

  // Reverse customer balances
  for (const [customerId, amount] of balanceReversal) {
    const customerRef = db.collection("customers").doc(customerId);
    batch.update(customerRef, {
      currentBalance: admin.firestore.FieldValue.increment(-amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    totalOps++;
    await flushIfNeeded();
  }

  // Flush remaining
  if (totalOps > 0) {
    await batch.commit();
  }

  console.log(`\n✅  Done.`);
  console.log(`    Deleted: ${cardsSnap.size} migrated card(s)`);
  console.log(`    Deleted: ${requestsSnap.size} migration request(s)`);
  console.log(`    Balance reversed for: ${balanceReversal.size} customer(s)\n`);
  process.exit(0);
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
