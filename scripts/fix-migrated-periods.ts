/**
 * Re-generates tickedPeriods for all migrated savings_cards.
 *
 * Correct formula: totalDays = (totalSavings + adminCommission) / dailyMarking
 * so that the calendar shows commission days in gold and net savings days as
 * available/withdrawn. currentBalance = cardBal (already commission-adjusted).
 *
 * Run: npx tsx --env-file=.env.local scripts/fix-migrated-periods.ts
 */

import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { RAW_ROWS } from "../lib/migration/records";
import { forwardFill } from "../lib/migration/migrationData";

const projectId   = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

const app = getApps().length
  ? getApp()
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const db = getFirestore(app);

// ── Virtual date generator ────────────────────────────────────────────────────

function str(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function advance(year: number, month: number, day: number): [number, number, number] {
  day++;
  if (day > 31) { day = 1; month++; }
  if (month > 11) { month = 0; year++; }
  return [year, month, day];
}

function generateMigrationDates(anchorIso: string, count: number): string[] {
  let year  = parseInt(anchorIso.slice(0, 4));
  let month = parseInt(anchorIso.slice(5, 7)) - 1;
  let day   = parseInt(anchorIso.slice(8, 10));
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(str(year, month, day));
    [year, month, day] = advance(year, month, day);
  }
  return result;
}

// ── Build lookup: "migrationCode|cardName" → { totalSavings, adminCommission, dailyMarking } ──

const records = forwardFill(RAW_ROWS);
type Lookup = { totalSavings: number; adminCommission: number; dailyMarking: number; cardBal: number };
const lookup = new Map<string, Lookup>();
for (const r of records) {
  const key = `${r.migrationCode}|${r.customerName}`;
  lookup.set(key, {
    totalSavings:    r.totalSavings,
    adminCommission: r.adminCommission,
    dailyMarking:    r.dailyMarking,
    cardBal:         r.cardBal,
  });
}

async function main() {
  const snap = await db.collection("savings_cards").where("migrated", "==", true).get();
  if (snap.empty) { console.log("No migrated cards found."); return; }
  console.log(`Found ${snap.docs.length} migrated cards\n`);

  const ANCHOR = "2026-01-01";
  const BATCH_SIZE = 400;
  let updates = 0;
  let skipped = 0;
  let unmatched = 0;

  for (let start = 0; start < snap.docs.length; start += BATCH_SIZE) {
    const chunk = snap.docs.slice(start, start + BATCH_SIZE);
    const batch = db.batch();
    let batchWrites = 0;

    for (const doc of chunk) {
      const card = doc.data();
      const key  = `${card.migrationCode}|${card.cardName}`;
      const rec  = lookup.get(key);

      if (!rec) {
        console.warn(`UNMATCHED   id=${doc.id}  code=${card.migrationCode}  name="${card.cardName}"`);
        unmatched++;
        continue;
      }

      const daysMarked = rec.dailyMarking > 0
        ? Math.round((rec.totalSavings + rec.adminCommission) / rec.dailyMarking)
        : 0;

      if (daysMarked === 0) {
        console.log(`SKIP (0d)    id=${doc.id}  name="${card.cardName}"`);
        skipped++;
        continue;
      }

      const newPeriods = generateMigrationDates(ANCHOR, daysMarked);
      const existing: string[] = card.tickedPeriods ?? [];

      // Already correct: same count and starts at anchor
      if (existing.length === daysMarked && existing[0] === ANCHOR) {
        console.log(`SKIP (ok)    id=${doc.id}  name="${card.cardName}"  days=${daysMarked}`);
        skipped++;
        continue;
      }

      console.log(
        `UPDATE       id=${doc.id}  name="${card.cardName}"  ` +
        `days=${existing.length}→${daysMarked}  ` +
        `last=${existing.at(-1) ?? "?"}→${newPeriods.at(-1)}`
      );
      batch.update(doc.ref, {
        tickedPeriods: newPeriods,
        migrationAdminCommission: rec.adminCommission,
      });
      batchWrites++;
      updates++;
    }

    if (batchWrites > 0) await batch.commit();
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`Done.  Updated=${updates}  Skipped=${skipped}  Unmatched=${unmatched}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
