import { tsToMs } from "@/lib/utils/fmt-date";

/**
 * One confirmed payment's contribution to a card's calendar.
 * Sourced from the `contributions` collection — only new-format
 * (multi-card) contributions carry `cardId`, so migrated cards' imported
 * history (which never went through a contribution doc) simply has no
 * matching batch. Days with no batch fall back to the plain "available"
 * color — that's what keeps migrated pre-history excluded automatically,
 * with no special-casing needed here.
 */
export interface PaymentBatch {
  amount: number;
  periods: string[];
  confirmedAt: unknown; // Firestore timestamp, any serialisation
}

export interface WithdrawalBatch {
  amount: number;
  paidAt: unknown;
}

export type BatchColor = "a" | "b";

export interface BatchClassification {
  /** day → alternating color, for every day that belongs to a known payment batch. */
  batchColorByDay: Map<string, BatchColor>;
  /** The most recently confirmed payment batch, for a "last marked" summary line. */
  lastPayment: { amount: number; confirmedAt: unknown } | null;
}

/**
 * Assigns alternating colors to payment batches in chronological order —
 * batch 1 green, batch 2 blue, batch 3 green, and so on — so adjacent
 * payments are always visually distinct on the calendar.
 */
export function classifyBatches(batches: PaymentBatch[]): BatchClassification {
  const sorted = [...batches].sort((a, b) => (tsToMs(a.confirmedAt) ?? 0) - (tsToMs(b.confirmedAt) ?? 0));

  const batchColorByDay = new Map<string, BatchColor>();
  sorted.forEach((batch, i) => {
    const color: BatchColor = i % 2 === 0 ? "a" : "b";
    for (const p of batch.periods) batchColorByDay.set(p, color);
  });

  const last = sorted.at(-1);
  const lastPayment = last ? { amount: last.amount, confirmedAt: last.confirmedAt } : null;

  return { batchColorByDay, lastPayment };
}

/** Most recent paid withdrawal that drew from this specific card, if any. */
export function lastWithdrawalFor(withdrawals: WithdrawalBatch[]): { amount: number; paidAt: unknown } | null {
  if (withdrawals.length === 0) return null;
  return [...withdrawals].sort((a, b) => (tsToMs(b.paidAt) ?? 0) - (tsToMs(a.paidAt) ?? 0))[0];
}

export interface MonthlyTotal {
  amount: number;
  approximate: boolean; // true if any of this month's total came from the fallback below
}

/**
 * Buckets total amount paid by "YYYY-MM". Real payment batches are the source
 * of truth; a batch's periods can span a virtual month boundary (this happens
 * in practice whenever a payment starts near the end of one virtual 31-day
 * month and runs into the next), so each batch is split by its periods' month
 * prefixes and priced at amount/periods.length per day — this also correctly
 * reflects a historical daily-rate change rather than pricing old months at
 * the card's current rate.
 *
 * Migrated cards have zero payment-batch coverage for their pre-migration
 * history (migration writes tickedPeriods directly onto the card, no
 * contribution docs). Any day in availableSet not covered by a real batch
 * falls back to dailyAmt/day, flagged approximate, so every card still gets
 * a total for every month it has marked days in.
 */
export function computeMonthlyTotals(
  batches: PaymentBatch[],
  availableSet: Set<string>,
  dailyAmt: number
): Map<string, MonthlyTotal> {
  const totals = new Map<string, MonthlyTotal>();
  const add = (monthKey: string, amount: number, approximate: boolean) => {
    const existing = totals.get(monthKey) ?? { amount: 0, approximate: false };
    existing.amount += amount;
    existing.approximate = existing.approximate || approximate;
    totals.set(monthKey, existing);
  };

  const coveredDays = new Set<string>();
  for (const batch of batches) {
    if (batch.periods.length === 0) continue;
    const perDayRate = batch.amount / batch.periods.length;
    const byMonth = new Map<string, number>();
    for (const p of batch.periods) {
      coveredDays.add(p);
      byMonth.set(p.slice(0, 7), (byMonth.get(p.slice(0, 7)) ?? 0) + 1);
    }
    for (const [monthKey, count] of Array.from(byMonth)) add(monthKey, perDayRate * count, false);
  }

  for (const day of Array.from(availableSet)) {
    if (!coveredDays.has(day)) add(day.slice(0, 7), dailyAmt, true);
  }

  return totals;
}

/** "15000" → "15K", "500" → "₦500" (too small to abbreviate usefully). */
export function formatK(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return (Number.isInteger(k) ? String(k) : k.toFixed(1)) + "K";
  }
  return "₦" + n.toLocaleString("en-NG");
}
