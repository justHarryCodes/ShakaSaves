export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, notFound } from "@/lib/api-helpers";
import { getCardById } from "@/lib/firestore/cards";
import { getCustomerById } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";
import { db } from "@/lib/firebase-admin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async () => {
    const card = await getCardById(params.id);
    if (!card) return notFound("Card not found");

    const [customer, plans, withdrawalsSnap] = await Promise.all([
      getCustomerById(card.customerId),
      listActivePlans(),
      // Fetch paid withdrawals to compute true withdrawn amount per card.
      // mark-paid sets migrationAmountWtd going forward, but older withdrawals may
      // predate that field — summing cardSelections gives the authoritative total.
      db.collection("withdrawals")
        .where("customerId", "==", card.customerId)
        .where("status", "==", "paid")
        .get(),
    ]);

    const plan = plans.find((p) => p.name.toLowerCase() === (card.category ?? "").toLowerCase()) ?? null;

    // Sum amountFromCard for every paid withdrawal that targeted this card explicitly.
    let withdrawnFromHistory = 0;
    for (const doc of withdrawalsSnap.docs) {
      const sels = (doc.data().cardSelections ?? []) as Array<{ cardId: string; amountFromCard: number }>;
      for (const sel of sels) {
        if (sel.cardId === card.id) withdrawnFromHistory += sel.amountFromCard;
      }
    }

    // Use whichever is higher — covers legacy withdrawals already in migrationAmountWtd
    // AND new-path withdrawals that may not have set the field yet (e.g. older code).
    const enrichedCard = {
      ...card,
      migrationAmountWtd: Math.max(card.migrationAmountWtd ?? 0, withdrawnFromHistory),
    };

    return ok({ card: enrichedCard, customer, plan });
  });
}
