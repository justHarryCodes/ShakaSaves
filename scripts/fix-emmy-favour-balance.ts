/**
 * Corrects the same migration data-entry error class as
 * fix-stephen-maxwell-balance.ts, for two more customers found by checking
 * every row in lib/migration/records.ts against cardBal = totalSavings - amountWtd:
 *
 *   Emmy Royalty:  totalSavings 90000, amountWtd 75000 -> cardBal should be 15000,
 *                  recorded as 0. Zero withdrawal requests ever made on this card —
 *                  confirmed nothing to double-credit against.
 *   Favour 2:      totalSavings 180000, amountWtd 118500 -> cardBal should be 61500,
 *                  recorded as 45000. She has since paid-withdrawn exactly that
 *                  original (wrong) 45000 in full (withdrawal cB8LkLli0vZHYIvEsGMI,
 *                  2026-08-25) — the missing 16500 was never part of any withdrawal,
 *                  it was simply never credited to her balance to begin with.
 *
 * Both corrections are applied as increments on top of whatever each card's
 * CURRENT balance is (not a hard set to the historical figure), since real
 * activity has happened on both accounts since migration and the shortfall is
 * additive, not a replacement value.
 *
 * Run: npx tsx --env-file=.env.local scripts/fix-emmy-favour-balance.ts
 */

import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId   = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

const app  = getApps().length ? getApp() : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db   = getFirestore(app);
const auth = getAuth(app);

const CORRECTIONS = [
  { cardId: "xlr48OLDvsqX25erbwKT", customerId: "UI3cxLYd217agOaQP1oV", amount: 15000, label: "Emmy Royalty" },
  { cardId: "TkDlZEzwsFUcZJwnCO9N", customerId: "AzQf1G5odrgd2U6bTyZ3", amount: 16500, label: "Favour 2 (Favour Zipamor)" },
];

async function main() {
  let adminUid = "system-correction";
  try {
    const users = await auth.listUsers(1000);
    const admin = users.users.find((u) => u.customClaims?.role === "admin");
    if (admin) adminUid = admin.uid;
  } catch {}

  for (const fix of CORRECTIONS) {
    const cardRef = db.collection("savings_cards").doc(fix.cardId);
    const customerRef = db.collection("customers").doc(fix.customerId);
    const [cardDoc, customerDoc] = await Promise.all([cardRef.get(), customerRef.get()]);

    if (!cardDoc.exists || !customerDoc.exists) {
      console.error(`❌ ${fix.label}: card or customer doc not found. Skipping.`);
      continue;
    }

    const card = cardDoc.data()!;
    const customer = customerDoc.data()!;
    console.log(`\n=== ${fix.label} ===`);
    console.log(`  Before: card.currentBalance=${card.currentBalance}  customer.currentBalance=${customer.currentBalance}`);

    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (t) => {
      t.update(cardRef, { currentBalance: FieldValue.increment(fix.amount), updatedAt: now });
      t.update(customerRef, { currentBalance: FieldValue.increment(fix.amount), updatedAt: now });
      t.set(db.collection("audit_logs").doc(), {
        action: "admin.balance_correction",
        performedBy: adminUid,
        performedByRole: "admin",
        targetId: fix.cardId,
        targetCollection: "savings_cards",
        before: { cardBalance: card.currentBalance, customerBalance: customer.currentBalance },
        after: {
          cardBalance: card.currentBalance + fix.amount,
          customerBalance: (customer.currentBalance ?? 0) + fix.amount,
          reason: `Migration data entry error, same class as Stephen Maxwell's SS13 correction — recorded cardBal did not reconcile as totalSavings - amountWtd. Verified against full withdrawal history before applying: no double-credit risk.`,
        },
        timestamp: now,
        ipAddress: "script:fix-emmy-favour-balance",
      });
    });

    console.log(`  After:  card.currentBalance=${card.currentBalance + fix.amount}  customer.currentBalance=${(customer.currentBalance ?? 0) + fix.amount}`);
    console.log(`  ✅ Credited +₦${fix.amount.toLocaleString()}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
