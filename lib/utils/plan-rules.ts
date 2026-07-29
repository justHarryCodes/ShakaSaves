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
