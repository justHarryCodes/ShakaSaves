/**
 * Corrects a migration data-entry error for Stephen Maxwell's card ("Ndidi
 * Maxwell", migrationCode SS13).
 *
 * Every other row in lib/migration/records.ts reconciles as
 * cardBal = totalSavings - amountWtd. This row didn't:
 *   totalSavings: 97000, amountWtd: 65000  →  should be cardBal 32000
 *   but was recorded as cardBal: 0
 *
 * That wrong cardBal became currentBalance at migration-approval time, on
 * both the card doc and the customer's aggregate balance (approve/route.ts
 * increments the customer by the sum of cardBal across sub-accounts) — so
 * both are short by the same ₦32,000.
 *
 * Run: npx tsx --env-file=.env.local scripts/fix-stephen-maxwell-balance.ts
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

const CARD_ID     = "rX4yyvphsORFMrkeXS84"; // "Ndidi Maxwell"
const CUSTOMER_ID = "dXoxcMBIqxDyiYvNUsvz"; // Stephen Maxwell
const CORRECTION  = 32000; // 97000 - 65000, missing from the recorded cardBal of 0

async function main() {
  const cardRef = db.collection("savings_cards").doc(CARD_ID);
  const customerRef = db.collection("customers").doc(CUSTOMER_ID);

  const [cardDoc, customerDoc] = await Promise.all([cardRef.get(), customerRef.get()]);
  if (!cardDoc.exists) { console.error(`❌ Card ${CARD_ID} not found.`); process.exit(1); }
  if (!customerDoc.exists) { console.error(`❌ Customer ${CUSTOMER_ID} not found.`); process.exit(1); }

  const card = cardDoc.data()!;
  const customer = customerDoc.data()!;

  console.log("Before:");
  console.log(`  card.currentBalance:     ${card.currentBalance}  (cardName=${card.cardName})`);
  console.log(`  customer.currentBalance: ${customer.currentBalance}  (fullName=${customer.fullName})`);

  if (card.currentBalance !== 0 || customer.currentBalance !== 0) {
    console.warn("⚠  Balances are not both 0 as expected — something else may have changed them since diagnosis. Aborting; verify manually.");
    process.exit(1);
  }

  // Find the admin uid for audit attribution
  let adminUid = "system-correction";
  try {
    const users = await auth.listUsers(1000);
    const admin = users.users.find((u) => u.customClaims?.role === "admin");
    if (admin) adminUid = admin.uid;
  } catch {}

  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (t) => {
    t.update(cardRef, { currentBalance: CORRECTION, updatedAt: now });
    t.update(customerRef, { currentBalance: FieldValue.increment(CORRECTION), updatedAt: now });
    t.set(db.collection("audit_logs").doc(), {
      action: "admin.balance_correction",
      performedBy: adminUid,
      performedByRole: "admin",
      targetId: CARD_ID,
      targetCollection: "savings_cards",
      before: { cardBalance: card.currentBalance, customerBalance: customer.currentBalance },
      after: {
        cardBalance: CORRECTION,
        customerBalance: (customer.currentBalance ?? 0) + CORRECTION,
        reason: "Migration data entry error — records.ts SS13 recorded cardBal=0 instead of the reconciled totalSavings(97000) - amountWtd(65000) = 32000. Confirmed against admin's own records before applying.",
      },
      timestamp: now,
      ipAddress: "script:fix-stephen-maxwell-balance",
    });
  });

  console.log("\n✅ Corrected:");
  console.log(`   card.currentBalance:     0 → ${CORRECTION}`);
  console.log(`   customer.currentBalance: 0 → ${CORRECTION}`);
  console.log("   Audit log entry written to audit_logs.");
}

main().catch((e) => { console.error(e); process.exit(1); });
