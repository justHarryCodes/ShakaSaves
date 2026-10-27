export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { withRole, ok, err, notFound, validationError, getIpFromRequest } from "@/lib/api-helpers";
import { getCustomerById } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWithdrawalPaid } from "@/lib/notifications";
import { db } from "@/lib/firebase-admin";
import { resolveEffectivePlan } from "@/lib/utils/plan-rules";
import { computeWithdrawable, computeEarlyExitCommission } from "@/lib/utils/card-withdrawable";
import type { SavingsCard } from "@/types";

const adminWithdrawSchema = z.object({
  /** Gross amount taken off the card. Commission comes out of this; the rest is paid out. */
  amount: z.number().positive(),
  /** Admin override of the early-exit commission. Omit to use the computed figure. */
  commission: z.number().min(0).optional(),
  bankName: z.string().max(100).optional().default(""),
  accountNumber: z.string().max(20).optional().default(""),
  accountName: z.string().max(100).optional().default(""),
  note: z.string().max(500).optional().nullable(),
});

/**
 * Admin withdraws from a card on the customer's behalf. Ignores the card's lock —
 * if the lock hasn't run out, the full-term commission (computeEarlyExitCommission)
 * is taken from the amount before the remainder is paid to the customer. The
 * withdrawal is recorded already "paid" since the admin is the one paying it out.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const body = await req.json().catch(() => null);
    const parsed = adminWithdrawSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);
    const input = parsed.data;

    const cardRef = db.collection("savings_cards").doc(params.id);
    const plans = await listActivePlans();

    type Result = {
      withdrawalId: string;
      customerId: string;
      cardName: string;
      commission: number;
      computedCommission: number;
      payout: number;
      lockDays: number | null;
    };

    let result: Result;
    try {
      result = await db.runTransaction(async (t) => {
        const cardDoc = await t.get(cardRef);
        if (!cardDoc.exists) throw new Error("NOT_FOUND");
        const card = { id: cardDoc.id, ...cardDoc.data() } as SavingsCard;

        const plan = plans.find((p) => p.name.toLowerCase() === (card.category ?? "").toLowerCase()) ?? null;
        const effective = resolveEffectivePlan(card.category, plan, card);
        const { withdrawable } = computeWithdrawable(card);
        if (input.amount > withdrawable) throw new Error(`INSUFFICIENT:${withdrawable}`);

        const early = computeEarlyExitCommission(card, effective?.lockDays);
        const commission = Math.round(input.commission ?? Math.min(early.commission, input.amount));
        if (commission > input.amount) throw new Error("COMMISSION_TOO_HIGH");
        const payout = input.amount - commission;

        const now = FieldValue.serverTimestamp();
        const withdrawalRef = db.collection("withdrawals").doc();
        t.set(withdrawalRef, {
          customerId: card.customerId,
          amountRequested: input.amount,
          cardSelections: [{ cardId: card.id, cardName: card.cardName ?? "Savings Card", amountFromCard: input.amount }],
          requestedAt: now,
          status: "paid",
          reviewedBy: decoded.uid,
          reviewedAt: now,
          rejectionReason: null,
          paidAt: now,
          accountNumber: input.accountNumber,
          accountName: input.accountName,
          bankName: input.bankName,
          note: input.note ?? null,
          initiatedBy: "admin",
          commissionDeducted: commission,
          amountPaidOut: payout,
        });
        // Whole amount leaves the card (payout + commission), so it's all counted as
        // withdrawn — same fields mark-paid updates for customer-requested withdrawals.
        t.update(cardRef, {
          currentBalance: FieldValue.increment(-input.amount),
          migrationAmountWtd: FieldValue.increment(input.amount),
          ...(commission > 0 ? { earlyCommissionCharged: FieldValue.increment(commission) } : {}),
          updatedAt: now,
        });
        t.update(db.collection("customers").doc(card.customerId), {
          currentBalance: FieldValue.increment(-input.amount),
          updatedAt: now,
        });

        return {
          withdrawalId: withdrawalRef.id,
          customerId: card.customerId,
          cardName: card.cardName ?? "Savings Card",
          commission,
          computedCommission: early.commission,
          payout,
          lockDays: effective?.lockDays ?? null,
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return notFound("Card not found");
      if (msg === "COMMISSION_TOO_HIGH") return err("COMMISSION_TOO_HIGH", "Commission cannot exceed the withdrawal amount", 400);
      if (msg.startsWith("INSUFFICIENT:")) {
        const available = Number(msg.split(":")[1]);
        return err("INSUFFICIENT_BALANCE", `Card only has ₦${available.toLocaleString("en-NG")} withdrawable`, 400);
      }
      throw e;
    }

    try {
      await writeAuditLog({
        action: "withdrawal.admin_on_behalf",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: result.withdrawalId,
        targetCollection: "withdrawals",
        before: null,
        after: {
          cardId: params.id,
          amount: input.amount,
          commission: result.commission,
          computedCommission: result.computedCommission,
          payout: result.payout,
          lockDays: result.lockDays,
        },
        ipAddress: getIpFromRequest(req),
      });
    } catch (e) {
      console.error("writeAuditLog failed (non-fatal):", e);
    }

    try {
      const customer = await getCustomerById(result.customerId);
      if (customer && result.payout > 0) {
        await notifyWithdrawalPaid({
          customerUid: customer.uid,
          customerEmail: customer.email ?? "",
          amount: result.payout,
          withdrawalId: result.withdrawalId,
        });
      }
    } catch (e) {
      console.error("notifyWithdrawalPaid failed (non-fatal):", e);
    }

    return ok(result, 201);
  });
}
