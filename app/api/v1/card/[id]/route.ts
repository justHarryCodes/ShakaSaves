export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, notFound } from "@/lib/api-helpers";
import { getCardById } from "@/lib/firestore/cards";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";
import { db } from "@/lib/firebase-admin";

// GET /api/v1/card/[id] — customer fetches one of their own cards by Firestore doc ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return notFound("Customer not found");

    const card = await getCardById(params.id);
    if (!card) return notFound("Card not found");
    if (card.customerId !== customer.id) return err("FORBIDDEN", "Access denied", 403);

    const [plans, withdrawalsSnap] = await Promise.all([
      listActivePlans(),
      // Fetch paid withdrawals to compute true withdrawn amount per card.
      // mark-paid sets migrationAmountWtd going forward, but older withdrawals may
      // predate that field — summing cardSelections gives the authoritative total.
      db.collection("withdrawals")
        .where("customerId", "==", customer.id)
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

    return ok({ card: enrichedCard, plan });
  });
}
