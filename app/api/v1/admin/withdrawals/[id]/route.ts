export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, notFound } from "@/lib/api-helpers";
import { getWithdrawalById } from "@/lib/firestore/withdrawals";
import { getCustomerById } from "@/lib/firestore/customers";
import { listCardsByCustomer } from "@/lib/firestore/cards";
import { listActivePlans } from "@/lib/firestore/savings-plans";
import type { SavingsPlan } from "@/types";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async () => {
    const withdrawal = await getWithdrawalById(params.id);
    if (!withdrawal) return notFound("Withdrawal not found");

    const [customer, cards, plans] = await Promise.all([
      getCustomerById(withdrawal.customerId),
      listCardsByCustomer(withdrawal.customerId),
      listActivePlans(),
    ]);

    const planByName = new Map<string, SavingsPlan>(
      plans.map((p) => [p.name.toLowerCase(), p])
    );

    const cardsWithPlan = cards.map((card) => ({
      ...card,
      plan: planByName.get((card.category ?? "").toLowerCase()) ?? null,
    }));

    return ok({ withdrawal, customer, cards: cardsWithPlan });
  });
}
