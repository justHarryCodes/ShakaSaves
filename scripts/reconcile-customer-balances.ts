/**
 * reconcile-customer-balances.ts
 *
 * Finds customers whose `currentBalance` on the customer document has drifted
 * from the sum of their savings card balances, then optionally corrects them.
 *
 * Run with ts-node (dry-run, safe to run first):
 *   npx ts-node -e "require('./scripts/reconcile-customer-balances.ts')"
 *
 * To apply fixes, change DRY_RUN to false:
 *   DRY_RUN=false npx ts-node -e "require('./scripts/reconcile-customer-balances.ts')"
 */

import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.env.DRY_RUN !== "false";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

async function main() {
  console.log(`\n=== Customer Balance Reconciliation (DRY_RUN=${DRY_RUN}) ===\n`);

  const [customersSnap, cardsSnap] = await Promise.all([
    db.collection("customers").get(),
    db.collection("savings_cards").get(),
  ]);

  // Build a map of customerId → sum of card balances
  const cardTotals = new Map<string, number>();
  for (const doc of cardsSnap.docs) {
    const data = doc.data();
    const cid = data.customerId as string;
    const bal = (data.currentBalance as number) ?? 0;
    cardTotals.set(cid, (cardTotals.get(cid) ?? 0) + bal);
  }

  let driftCount = 0;
  const fixes: Array<{ ref: FirebaseFirestore.DocumentReference; correct: number }> = [];

  for (const doc of customersSnap.docs) {
    const data = doc.data();
    const name = data.fullName as string;
    const stored = (data.currentBalance as number) ?? 0;
    const fromCards = cardTotals.get(doc.id) ?? null;

    // Skip customers who have no savings cards at all
    if (fromCards === null) continue;

    const drift = Math.abs(stored - fromCards);
    if (drift === 0) continue;

    driftCount++;
    console.log(`⚠  ${name} (${doc.id})`);
    console.log(`   customer.currentBalance : ${naira(stored)}`);
    console.log(`   sum of card balances    : ${naira(fromCards)}`);
    console.log(`   drift                   : ${naira(drift)}\n`);

    fixes.push({ ref: doc.ref, correct: fromCards });
  }

  if (driftCount === 0) {
    console.log("✅ All customer balances match their card totals — nothing to fix.\n");
    return;
  }

  console.log(`Found ${driftCount} customer(s) with balance drift.`);

  if (DRY_RUN) {
    console.log("\nDry-run mode: no changes written. Set DRY_RUN=false to apply fixes.\n");
    return;
  }

  // Apply fixes in a batch
  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const { ref, correct } of fixes) {
    batch.update(ref, { currentBalance: correct, updatedAt: now });
  }
  await batch.commit();

  console.log(`\n✅ Fixed ${fixes.length} customer(s). Balances now match card totals.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
