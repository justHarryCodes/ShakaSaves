/**
 * Splits a card's ticked periods into three sets:
 *
 * - commissionSet  – the LAST marked day of each calendar month (gold, admin cut)
 *                    Only populated when hasCommission = true (Regular, Project 1M).
 *                    FoodBank and other zero-commission plans pass hasCommission = false.
 * - withdrawnSet   – non-commission days from the chronological START equal to withdrawnAmount / dailyAmount (red)
 * - availableSet   – remaining non-commission days (green)
 *
 * Commission is always 1 day per month regardless of how many days that month has marked.
 * Withdrawn days are counted from the earliest marked day forwards.
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

  // Last marked day of each calendar month → commission (gold).
  // Skipped entirely for FoodBank / zero-commission plan types.
  let commissionSet = new Set<string>();
  if (hasCommission) {
    const lastPerMonth = new Map<string, string>(); // "YYYY-MM" → "YYYY-MM-DD"
    for (const p of sorted) {
      lastPerMonth.set(p.slice(0, 7), p); // ascending iteration → later write wins
    }
    commissionSet = new Set(lastPerMonth.values());
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
