import { tsToMs } from "@/lib/utils/fmt-date";

/** The app's virtual calendar gives every month exactly 31 days. */
const DAYS_PER_MONTH = 31;

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
  migrationAmountWtd?: number;
}): { withdrawable: number; additionalCommission: number; commissionHeld: number; grossSaved: number } {
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

  // Total ever saved by the customer, commission excluded — the one number every
  // "Total saved" tile across the app should show. currentBalance's relationship to
  // commission differs by card type (a new card's currentBalance still has this
  // month's commission sitting in it, uncounted-for, until additionalCommission
  // grows enough to hold it back; a migrated card's currentBalance already had its
  // historical commission carved out during import, before migrationCommission was
  // even known as a separate figure) — subtracting additionalCommission here is what
  // reconciles both cases to the same meaning: money withdrawn is added back,
  // whatever commission is still sitting uncounted-for in currentBalance is removed.
  const withdrawnAmount = card.migrationAmountWtd ?? 0;
  const grossSaved = Math.max(0, card.currentBalance + withdrawnAmount - additionalCommission);

  return { withdrawable, additionalCommission, commissionHeld, grossSaved };
}

/**
 * Commission owed when an admin pays out a card BEFORE its lock period ends.
 *
 * The customer committed to the full term, so the admin earns commission for the
 * whole term (1 day's contribution per month) even if only part of it was saved —
 * e.g. a 365-day FoodBank card at ₦1,000/day withdrawn after one month owes
 * 12 × ₦1,000 = ₦12,000, taken from the funds before the rest is paid out.
 *
 * Commission already held back by computeWithdrawable (Regular / Project 1M accrue
 * it monthly) and any early-exit commission charged on a previous early withdrawal
 * are subtracted, so the full-term figure is only ever collected once per card.
 * Returns 0 when the card isn't time-locked or the lock has already run out.
 */
export function computeEarlyExitCommission(
  card: Parameters<typeof computeWithdrawable>[0] & {
    createdAt?: unknown;
    earlyCommissionCharged?: number;
  },
  lockDays: number | undefined,
  nowMs = Date.now()
): { locked: boolean; termMonths: number; fullTermCommission: number; commission: number } {
  const none = { locked: false, termMonths: 0, fullTermCommission: 0, commission: 0 };
  if (!lockDays || lockDays <= 0) return none;

  const createdMs = tsToMs(card.createdAt);
  const locked = createdMs == null || (nowMs - createdMs) / 86_400_000 < lockDays;
  if (!locked) return none;

  // Every month in the app's calendar is 31 days (see virtual-dates.ts); a partial
  // month counts as a full one. 365 days → 12 months, 186 → 6, 31 → 1.
  const termMonths = Math.max(1, Math.ceil(lockDays / DAYS_PER_MONTH));
  const fullTermCommission = termMonths * (card.dailyAmount ?? 0);
  const { commissionHeld } = computeWithdrawable(card);
  const commission = Math.max(0, fullTermCommission - commissionHeld - (card.earlyCommissionCharged ?? 0));

  return { locked, termMonths, fullTermCommission, commission };
}
