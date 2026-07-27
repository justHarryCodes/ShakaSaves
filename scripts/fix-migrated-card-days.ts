/**
 * One-off fix for migrated SavingsCards in Firestore.
 *
 * The approval route had a bug:
 *   - dailyAmount was set to Math.round(totalSavings / dailyMarking) — the day COUNT, not the ₦ rate
 *   - tickedPeriods was left as []
 *
 * This script:
 *   1. Sets dailyAmount  → migrationDailyMarking (the actual ₦/day rate, e.g. 3000)
 *   2. Builds tickedPeriods → consecutive YYYY-MM-DD dates from Jan 1 of START_YEAR
 *      for Math.round(migrationTotalSavings / migrationDailyMarking) days
 *
 * Usage:
 *   npx tsx scripts/fix-migrated-card-days.ts          # default start year: 2025
 *   npx tsx scripts/fix-migrated-card-days.ts 2024     # use Jan 1, 2024 as start
 *
 * Safe to re-run — skips cards where dailyAmount already equals migrationDailyMarking.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";

const [, , yearArg] = process.argv;
const START_YEAR = yearArg ? parseInt(yearArg, 10) : 2025;

if (isNaN(START_YEAR) || START_YEAR < 2020 || START_YEAR > 2030) {
  console.error("❌ Invalid year. Provide a 4-digit year between 2020 and 2030.");
  process.exit(1);
}

const START_DATE = new Date(Date.UTC(START_YEAR, 0, 1)); // Jan 1, START_YEAR UTC

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
  const periods: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(START_DATE);
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

  console.log(`\nFound ${snap.size} migrated card(s). Start date: Jan 1, ${START_YEAR}\n`);

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

    // Already fixed — dailyAmount already equals the ₦ daily rate
    if (data.dailyAmount === rate) {
      console.log(`  ✓  ${doc.id} (${data.cardName ?? "?"}) — already correct, skipping`);
      skipped++;
      continue;
    }

    const days         = Math.round(savings / rate);
    const tickedPeriods = buildTickedPeriods(days);

    try {
      await doc.ref.update({
        dailyAmount:   rate,         // ₦ per day (e.g. 3000)
        tickedPeriods,               // ["2025-01-01", "2025-01-02", …]
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
