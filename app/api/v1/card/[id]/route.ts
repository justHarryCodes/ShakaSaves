export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, notFound } from "@/lib/api-helpers";
import { getCardById } from "@/lib/firestore/cards";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";
import { getContributionsByCustomer } from "@/lib/firestore/contributions";
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

    const [plans, withdrawalsSnap, contributions] = await Promise.all([
      listActivePlans(),
      // Fetch paid withdrawals to compute true withdrawn amount per card.
      // mark-paid sets migrationAmountWtd going forward, but older withdrawals may
      // predate that field — summing cardSelections gives the authoritative total.
      db.collection("withdrawals")
        .where("customerId", "==", customer.id)
        .where("status", "==", "paid")
        .get(),
      // Reuse the already-indexed per-customer contributions query and filter to this
      // card in memory — avoids provisioning a new (cardId + confirmedAt) composite index.
      getContributionsByCustomer(customer.id),
    ]);

    const plan = plans.find((p) => p.name.toLowerCase() === (card.category ?? "").toLowerCase()) ?? null;

    // Sum amountFromCard for every paid withdrawal that targeted this card explicitly,
    // and keep the per-withdrawal breakdown for the "last withdrawal" summary.
    let withdrawnFromHistory = 0;
    const withdrawalBatches: { amount: number; paidAt: unknown }[] = [];
    for (const doc of withdrawalsSnap.docs) {
      const data = doc.data();
      const sels = (data.cardSelections ?? []) as Array<{ cardId: string; amountFromCard: number }>;
      for (const sel of sels) {
        if (sel.cardId === card.id) {
          withdrawnFromHistory += sel.amountFromCard;
          withdrawalBatches.push({ amount: sel.amountFromCard, paidAt: data.paidAt });
        }
      }
    }

    // Use whichever is higher — covers legacy withdrawals already in migrationAmountWtd
    // AND new-path withdrawals that may not have set the field yet (e.g. older code).
    const enrichedCard = {
      ...card,
      migrationAmountWtd: Math.max(card.migrationAmountWtd ?? 0, withdrawnFromHistory),
    };

    // Only new-format (multi-card) contributions carry cardId — a migrated card's
    // imported history never went through a contribution doc, so it has none here
    // and is naturally excluded from the payment-batch coloring.
    const paymentBatches = contributions
      .filter((c) => c.cardId === card.id)
      .map((c) => ({ amount: c.amount, periods: c.periodsMarked ?? [], confirmedAt: c.confirmedAt }));

    return ok({ card: enrichedCard, plan, paymentBatches, withdrawalBatches });
  });
}
