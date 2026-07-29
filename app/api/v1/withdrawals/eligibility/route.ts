export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withFinancialAuth, ok, err } from "@/lib/api-helpers";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";
import { db } from "@/lib/firebase-admin";
import type { SavingsCard, SavingsPlan } from "@/types";
import { resolveEffectivePlan } from "@/lib/utils/plan-rules";

export async function GET(req: NextRequest) {
  return withFinancialAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer not found", 404);

    const [cardsSnap, activePlans] = await Promise.all([
      db.collection("savings_cards").where("customerId", "==", customer.id).get(),
      listActivePlans(),
    ]);

    const planByName = new Map<string, SavingsPlan>(
      activePlans.map((p) => [p.name.toLowerCase(), p])
    );
    const nowMs = Date.now();

    let withdrawableBalance = 0;
    const cards: {
      id: string;
      cardName: string;
      category: string;
      currentBalance: number;
      dailyAmount: number;
      withdrawable: number;
      lockedReason: string | null;
    }[] = [];

    for (const doc of cardsSnap.docs) {
      const card = { id: doc.id, ...doc.data() } as SavingsCard & { id: string };
      const firestorePlan = planByName.get((card.category ?? "").toLowerCase()) ?? null;
      const effective = resolveEffectivePlan(card.category, firestorePlan);
      const dailyAmt = card.dailyAmount ?? 0;

      const netBalance = card.migrated
        ? card.currentBalance
        : Math.max(0, card.currentBalance - new Set(
            (card.tickedPeriods ?? []).map((p) => p.slice(0, 7))
          ).size * dailyAmt);

      let lockedReason: string | null = null;

      if (!effective) {
        // Regular — always eligible
      } else if (effective.lockDays) {
        const cardCreatedMs = (card.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? nowMs;
        const daysHeld = (nowMs - cardCreatedMs) / 86_400_000;
        if (daysHeld < effective.lockDays) {
          const unlockDate = new Date(cardCreatedMs + effective.lockDays * 86_400_000)
            .toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
          lockedReason = `Locked until ${unlockDate}`;
        }
      } else if (effective.targetAmount && card.currentBalance < effective.targetAmount) {
        const fmt = (n: number) => "₦" + n.toLocaleString("en-NG");
        lockedReason = `Requires ${fmt(effective.targetAmount)} saved (${fmt(card.currentBalance)} so far)`;
      }

      const withdrawable = lockedReason ? 0 : netBalance;
      withdrawableBalance += withdrawable;

      cards.push({
        id: card.id,
        cardName: card.cardName ?? "Savings Card",
        category: card.category ?? "Regular",
        currentBalance: card.currentBalance,
        dailyAmount: dailyAmt,
        withdrawable,
        lockedReason,
      });
    }

    return ok({ withdrawableBalance, cards });
  });
}
