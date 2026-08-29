/**
 * Splits a card's ticked periods into three sets:
 *
 * - commissionSet  – the FIRST marked day of each calendar month (gold, admin cut)
 *                    Only populated when hasCommission = true (Regular, Project 1M).
 *                    FoodBank and other zero-commission plans pass hasCommission = false.
 * - withdrawnSet   – non-commission days from the chronological START equal to withdrawnAmount / dailyAmount (red)
 * - availableSet   – remaining non-commission days (green)
 *
 * Commission is always 1 day per month regardless of how many days that month has marked.
 * Withdrawn days are counted from the earliest marked day forwards.
 *
 * Picking the FIRST marked day (not the last) is deliberate: it's the only choice that
 * never moves once assigned. A customer marking days one at a time within the same month
 * would otherwise see the gold cell keep jumping forward to whatever's newest — and every
 * day it moves off of reverts to its underlying batch color, which reads as that day's
 * color randomly changing after the fact. The actual commission amount is unaffected
 * either way — computeWithdrawable counts distinct months touched, not which specific day
 * this set contains — so this is a display-only stability fix, not a financial one.
 */
export function classifyPeriods(
  tickedPeriods: string[],
  dailyAmount: number,
  withdrawnAmount: number,
  hasCommission: boolean = true
): {
  withdrawnSet: Set<string>;
  commissionSet: Set<string>;
  availableSet: Set<string>;
  commissionDays: number;
  withdrawnDays: number;
} {
  const sorted = [...tickedPeriods].sort();

  // First marked day of each calendar month → commission (gold). Fixed permanently once
  // assigned — skipped entirely for FoodBank / zero-commission plan types.
  let commissionSet = new Set<string>();
  if (hasCommission) {
    const firstPerMonth = new Map<string, string>(); // "YYYY-MM" → "YYYY-MM-DD"
    for (const p of sorted) {
      const monthKey = p.slice(0, 7);
      if (!firstPerMonth.has(monthKey)) firstPerMonth.set(monthKey, p); // ascending iteration → earliest write wins, never overwritten
    }
    commissionSet = new Set(firstPerMonth.values());
  }
  const commissionDays = commissionSet.size;

  // Everything else, in chronological order
  const nonCommission = sorted.filter((p) => !commissionSet.has(p));

  const withdrawnDays =
    dailyAmount > 0
      ? Math.min(Math.round(withdrawnAmount / dailyAmount), nonCommission.length)
      : 0;

  const withdrawnSet = new Set(nonCommission.slice(0, withdrawnDays));
  const availableSet = new Set(nonCommission.slice(withdrawnDays));

  return { withdrawnSet, commissionSet, availableSet, commissionDays, withdrawnDays };
}
