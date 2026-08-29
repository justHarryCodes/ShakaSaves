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

/** "15000" → "15K", "500" → "₦500" (too small to abbreviate usefully). */
export function formatK(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return (Number.isInteger(k) ? String(k) : k.toFixed(1)) + "K";
  }
  return "₦" + n.toLocaleString("en-NG");
}
