/**
 * How much of a savings card's currentBalance is actually withdrawable, after
 * netting out the admin's running commission cut.
 *
 * Commission is never physically deducted from currentBalance when a day is
 * marked — every ticked day (commission day included) adds its full dailyAmount
 * to currentBalance (see payments/[id]/confirm). It's only ever held back here,
 * at withdrawal time. That means this MUST be computed identically everywhere a
 * withdrawal amount is decided or displayed — the eligibility check shown to the
 * customer, the request handler that actually authorizes a withdrawal, and the
 * card detail "Withdrawable" tiles. Any drift lets a withdrawal eat into the
 * commission reserve, which then shows up as balance stuck at ₦0 forever after
 * even though "green" (available) days still remain on the calendar.
 */
export function computeWithdrawable(card: {
  currentBalance: number;
  tickedPeriods?: string[];
  dailyAmount?: number;
  category?: string;
  migrated?: boolean;
  migrationAdminCommission?: number;
}): { withdrawable: number; additionalCommission: number; commissionHeld: number } {
  const dailyAmt = card.dailyAmount ?? 0;

  // FoodBank has no admin commission; Regular / Project 1M: 1 day per month.
  const hasCommission = card.category !== "FoodBank";
  const commissionMonths = hasCommission
    ? new Set((card.tickedPeriods ?? []).map((p) => p.slice(0, 7))).size
    : 0;
  const calendarCommission = commissionMonths * dailyAmt;

  // Commission already baked into currentBalance for migrated cards (stored at
  // import time); 0 for new cards. Only the commission accrued since then still
  // needs to be held back.
  const migrationCommission = card.migrated ? (card.migrationAdminCommission ?? 0) : 0;
  const additionalCommission = Math.max(0, calendarCommission - migrationCommission);
  const commissionHeld = migrationCommission + additionalCommission;
  const withdrawable = Math.max(0, card.currentBalance - additionalCommission);

  return { withdrawable, additionalCommission, commissionHeld };
}
