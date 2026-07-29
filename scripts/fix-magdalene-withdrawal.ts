/**
 * Applies the 9000 withdrawal that was paid from the "Magdalene" card (SS01).
 * The mark-paid route did not update card balances at the time, so:
 *   - currentBalance was still 9000 (should be 0)
 *   - migrationAmountWtd was still 654000 (should be 663000)
 *
 * Run: npx tsx --env-file=.env.local scripts/fix-magdalene-withdrawal.ts
 */

import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId   = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

const app = getApps().length ? getApp() : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db  = getFirestore(app);

// From records.ts SS01 "Magdalene" card:
const CARD_NAME         = "Magdalene";
const MIGRATION_CODE    = "SS01";
const WITHDRAWAL_AMOUNT = 9000;
const OLD_CARD_BAL      = 9000;   // cardBal at migration
const OLD_AMOUNT_WTD    = 654000; // amountWtd at migration
const EXPECTED_NEW_BAL  = 0;      // 9000 - 9000
const NEW_AMOUNT_WTD    = OLD_AMOUNT_WTD + WITHDRAWAL_AMOUNT; // 663000

async function main() {
  // Find the card by migrationCode + cardName
  const snap = await db.collection("savings_cards")
    .where("migrationCode", "==", MIGRATION_CODE)
    .where("cardName", "==", CARD_NAME)
    .get();

  if (snap.empty) {
    // Fallback: try just by cardName + migrated flag
    const snap2 = await db.collection("savings_cards")
      .where("cardName", "==", CARD_NAME)
      .where("migrated", "==", true)
      .get();

    if (snap2.empty) {
      console.error(`❌ No card found for "${CARD_NAME}" (migrationCode=${MIGRATION_CODE})`);
      process.exit(1);
    }

    console.log(`Found ${snap2.docs.length} card(s) matching cardName="${CARD_NAME}" + migrated=true`);
    for (const d of snap2.docs) {
      console.log(`  id=${d.id}  migrationCode=${d.data().migrationCode}  currentBalance=${d.data().currentBalance}  migrationAmountWtd=${d.data().migrationAmountWtd}`);
    }
    console.log("⚠  Multiple or unexpected matches — aborting. Verify the card ID and update manually.");
    process.exit(1);
  }

  if (snap.docs.length > 1) {
    console.error(`❌ Found ${snap.docs.length} cards — expected exactly 1. Aborting.`);
    for (const d of snap.docs) console.log(`  id=${d.id}  currentBalance=${d.data().currentBalance}`);
    process.exit(1);
  }

  const doc  = snap.docs[0];
  const data = doc.data();

  console.log("Card found:");
  console.log(`  id:                 ${doc.id}`);
  console.log(`  cardName:           ${data.cardName}`);
  console.log(`  migrationCode:      ${data.migrationCode}`);
  console.log(`  currentBalance:     ${data.currentBalance}  (expected ${OLD_CARD_BAL})`);
  console.log(`  migrationAmountWtd: ${data.migrationAmountWtd}  (expected ${OLD_AMOUNT_WTD})`);

  if (data.currentBalance !== OLD_CARD_BAL) {
    console.warn(`⚠  currentBalance is ${data.currentBalance}, expected ${OLD_CARD_BAL}. Proceeding anyway — will set to ${EXPECTED_NEW_BAL}.`);
  }

  await doc.ref.update({
    currentBalance:     EXPECTED_NEW_BAL,
    migrationAmountWtd: NEW_AMOUNT_WTD,
    updatedAt:          new Date(),
  });

  console.log(`\n✅ Updated card ${doc.id}:`);
  console.log(`   currentBalance:     ${data.currentBalance} → ${EXPECTED_NEW_BAL}`);
  console.log(`   migrationAmountWtd: ${data.migrationAmountWtd} → ${NEW_AMOUNT_WTD}`);
  console.log(`\nThe card will now show 0 withdrawable balance and all non-commission days red.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
