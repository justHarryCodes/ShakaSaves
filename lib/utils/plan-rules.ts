export type EffectivePlanConditions = {
  name: string;
  lockDays?: number;
  targetAmount?: number;
};

/**
 * Returns effective withdrawal conditions for a card.
 *
 * Priority: Firestore plan > hardcoded category defaults > null (unrestricted).
 *
 * Returns null only for Regular / unknown categories with no plan (= no restriction).
 * Non-Regular categories always get conditions — from Firestore if available, otherwise
 * from hardcoded defaults so migrated cards are still governed by their plan rules.
 */
export function resolveEffectivePlan(
  category: string | undefined | null,
  plan: { name: string; lockDays?: number; targetAmount?: number } | null
): EffectivePlanConditions | null {
  if (plan) {
    return { name: plan.name, lockDays: plan.lockDays, targetAmount: plan.targetAmount };
  }

  const cat = (category ?? "").toLowerCase();

  if (!cat || cat === "regular") return null;

  // Hardcoded defaults for known non-Regular categories
  if (cat === "foodbank") return { name: "FoodBank", lockDays: 365 };
  if (cat === "project 1m") return { name: "Project 1M", targetAmount: 1_000_000 };

  // Unrecognized non-Regular category → blocked (no specific condition known)
  return { name: category ?? "Savings Plan" };
}

export interface CardRulesDescription {
  name: string;
  /** Human sentence describing the withdrawal condition. */
  restriction: string;
  /** Same idea as restriction, compressed to fit a one-line card-tile caption
   *  (e.g. "Locked 200d", "Target ₦1,000,000", "Withdraw anytime"). */
  shortLabel: string;
  /** FoodBank has no admin commission; every other category does (1 day/month) —
   *  same check already used in card-withdrawable.ts and classify-periods.ts. */
  hasCommission: boolean;
  commissionNote: string;
}

/**
 * Human-readable guidance for a card — what its withdrawal rule means and
 * whether it carries admin commission. Reuses resolveEffectivePlan so this
 * always matches what actually gates a withdrawal, and prefers an admin-set
 * plan.description verbatim over the generated sentence when one exists.
 */
export function describeCardRules(
  category: string | undefined | null,
  plan: { name: string; lockDays?: number; targetAmount?: number; description?: string } | null,
  naira: (n: number) => string
): CardRulesDescription {
  const effective = resolveEffectivePlan(category, plan);
  const hasCommission = (category ?? "").toLowerCase() !== "foodbank";
  const commissionNote = hasCommission
    ? "1 day's contribution each month is held as admin commission."
    : "No admin commission on this plan.";

  const shortLabel = !effective
    ? "Withdraw anytime"
    : effective.lockDays ? `Locked ${effective.lockDays}d`
    : effective.targetAmount ? `Target ${naira(effective.targetAmount)}`
    : "Restricted";

  if (plan?.description) {
    return { name: effective?.name ?? plan.name, restriction: plan.description, shortLabel, hasCommission, commissionNote };
  }

  if (!effective) {
    return { name: "Regular", restriction: "Withdraw anytime — no lock period or savings target.", shortLabel, hasCommission, commissionNote };
  }
  if (effective.lockDays) {
    return { name: effective.name, restriction: `Locked for ${effective.lockDays} days from when this card was created.`, shortLabel, hasCommission, commissionNote };
  }
  if (effective.targetAmount) {
    return { name: effective.name, restriction: `Withdraw once you've saved ${naira(effective.targetAmount)} in total.`, shortLabel, hasCommission, commissionNote };
  }
  return { name: effective.name, restriction: "Contact support for this plan's withdrawal rules.", shortLabel, hasCommission, commissionNote };
}
