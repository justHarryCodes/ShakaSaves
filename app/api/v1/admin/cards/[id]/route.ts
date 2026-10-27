export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { withRole, ok, notFound, validationError, getIpFromRequest } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/firestore/audit";
import { getCardById } from "@/lib/firestore/cards";
import { getCustomerById } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";
import { getContributionsByCustomer } from "@/lib/firestore/contributions";
import { db } from "@/lib/firebase-admin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async () => {
    const card = await getCardById(params.id);
    if (!card) return notFound("Card not found");

    const [customer, plans, withdrawalsSnap, contributions] = await Promise.all([
      getCustomerById(card.customerId),
      listActivePlans(),
      // Fetch paid withdrawals to compute true withdrawn amount per card.
      // mark-paid sets migrationAmountWtd going forward, but older withdrawals may
      // predate that field — summing cardSelections gives the authoritative total.
      db.collection("withdrawals")
        .where("customerId", "==", card.customerId)
        .where("status", "==", "paid")
        .get(),
      // Reuse the already-indexed per-customer contributions query and filter to this
      // card in memory — avoids provisioning a new (cardId + confirmedAt) composite index.
      getContributionsByCustomer(card.customerId),
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

    return ok({ card: enrichedCard, customer, plan, paymentBatches, withdrawalBatches });
  });
}

const lockOverrideSchema = z.object({
  /** Days from card creation the card stays locked. 0 unlocks now; null restores the plan's rule. */
  lockDaysOverride: z.number().int().min(0).max(3650).nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const body = await req.json().catch(() => null);
    const parsed = lockOverrideSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const card = await getCardById(params.id);
    if (!card) return notFound("Card not found");

    const { lockDaysOverride, reason } = parsed.data;
    await db.collection("savings_cards").doc(params.id).update({
      lockDaysOverride,
      lockOverrideReason: lockDaysOverride === null ? null : (reason ?? null),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: "card.lock_override",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: params.id,
      targetCollection: "savings_cards",
      before: { lockDaysOverride: card.lockDaysOverride ?? null },
      after: { lockDaysOverride, reason: reason ?? null },
      ipAddress: getIpFromRequest(req),
    });

    return ok({ lockDaysOverride });
  });
}
