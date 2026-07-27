/**
 * One-off fix for migrated SavingsCards in Firestore.
 *
 * Builds tickedPeriods starting from Jan 1, 2026 (the admin-approved migration
 * start date) and counting forward for Math.round(totalSavings / dailyMarking) days.
 * Cards with many days will have future-dated ticked periods — that is expected.
 *
 * Usage:
 *   npx tsx scripts/fix-migrated-card-days.ts
 *
 * Safe to re-run — skips cards where tickedPeriods already starts on 2026-01-01.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";

const MIGRATION_START = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026
const MIGRATION_START_STR = MIGRATION_START.toISOString().split("T")[0]; // "2026-01-01"

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

function buildTickedPeriods(days: number): string[] {
  if (days <= 0) return [];
  const periods: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(MIGRATION_START);
    d.setUTCDate(d.getUTCDate() + i);
    periods.push(d.toISOString().split("T")[0]);
  }
  return periods;
}

async function run() {
  const db = admin.firestore();

  const snap = await db
    .collection("savings_cards")
    .where("migrated", "==", true)
    .get();

  if (snap.empty) {
    console.log("No migrated cards found.");
    process.exit(0);
  }

  console.log(`\nFound ${snap.size} migrated card(s). Start date: ${MIGRATION_START_STR}\n`);

  let updated  = 0;
  let skipped  = 0;
  let errored  = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const rate    = data.migrationDailyMarking as number | undefined;
    const savings = data.migrationTotalSavings as number | undefined;

    if (!rate || !savings) {
      console.warn(`  ⚠  ${doc.id} — missing migration fields, skipping`);
      skipped++;
      continue;
    }

    // Already correct — starts on Jan 1, 2026 with the right rate
    const existingPeriods: string[] = data.tickedPeriods ?? [];
    const firstPeriod = existingPeriods.length > 0 ? existingPeriods[0] : null;
    if (data.dailyAmount === rate && firstPeriod === MIGRATION_START_STR) {
      console.log(`  ✓  ${doc.id} (${data.cardName ?? "?"}) — already correct, skipping`);
      skipped++;
      continue;
    }

    const days         = Math.round(savings / rate);
    const tickedPeriods = buildTickedPeriods(days);

    try {
      await doc.ref.update({
        dailyAmount:   rate,
        tickedPeriods,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `  ✅  ${doc.id} (${data.cardName ?? "?"}) — ` +
        `₦${rate.toLocaleString()}/day · ${days} days marked · ` +
        `${tickedPeriods[0]} → ${tickedPeriods[tickedPeriods.length - 1]}`
      );
      updated++;
    } catch (e) {
      console.error(`  ❌  ${doc.id} — update failed:`, e);
      errored++;
    }
  }

  console.log(`\nDone. Updated: ${updated}  Skipped: ${skipped}  Errors: ${errored}\n`);
  process.exit(errored > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
