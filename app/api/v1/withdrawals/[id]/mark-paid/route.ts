export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound } from "@/lib/api-helpers";
import { getWithdrawalById } from "@/lib/firestore/withdrawals";
import { getCustomerById } from "@/lib/firestore/customers";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWithdrawalPaid } from "@/lib/notifications";
import { getIpFromRequest } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { SavingsCard } from "@/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const withdrawal = await getWithdrawalById(params.id);
    if (!withdrawal) return notFound("Withdrawal not found");
    if (withdrawal.status !== "approved") return err("NOT_APPROVED", "Withdrawal must be approved first", 409);

    const customer = await getCustomerById(withdrawal.customerId);
    if (!customer) return notFound("Customer not found");

    const amount = withdrawal.amountRequested;
    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const withdrawalRef = db.collection("withdrawals").doc(params.id);
    const customerRef = db.collection("customers").doc(withdrawal.customerId);

    type CardUpdate = { ref: FirebaseFirestore.DocumentReference; deducted: number };
    let cardUpdates: CardUpdate[] = [];

    try {
      await db.runTransaction(async (t) => {
        // ── All reads first (Firestore transaction requirement) ──

        // Re-check status inside the transaction — the check above ran before this
        // transaction started, so marking the same withdrawal paid twice concurrently
        // (a retry, or two admins) could otherwise both pass it and both pay out.
        const freshWithdrawal = await t.get(withdrawalRef);
        if (freshWithdrawal.data()?.status !== "approved") {
          throw new Error("NOT_APPROVED");
        }

        if (withdrawal.cardSelections && withdrawal.cardSelections.length > 0) {
          // ── New path: exact per-card deduction from the user's selection.
          // No need to read currentBalance at all — FieldValue.increment below applies
          // the deduction atomically, so only existence needs checking here. ──
          const cardRefs = withdrawal.cardSelections.map((sel) => db.collection("savings_cards").doc(sel.cardId));
          const cardDocs = await Promise.all(cardRefs.map((ref) => t.get(ref)));
          cardUpdates = withdrawal.cardSelections
            .map((sel, i) => ({ sel, doc: cardDocs[i] }))
            .filter(({ doc }) => doc.exists) // card deleted — skip gracefully
            .map(({ sel, doc }) => ({ ref: doc.ref, deducted: sel.amountFromCard }));
        } else {
          // ── Legacy path: sequential deduction across cards (oldest first). Unlike the
          // path above, how much to take from each card depends on that card's balance,
          // so the read and the deduction decision have to happen together inside this
          // transaction — reading them beforehand (as this used to) let two concurrent
          // mark-paid calls compute deductions from the same stale balances. ──
          const cardsSnap = await t.get(
            db.collection("savings_cards").where("customerId", "==", withdrawal.customerId)
          );
          const cardDocs = cardsSnap.docs.slice().sort((a, b) => {
            const aMs = (a.data().createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const bMs = (b.data().createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return aMs - bMs;
          });

          let remaining = amount;
          for (const doc of cardDocs) {
            if (remaining <= 0) break;
            const cardBalance = ((doc.data() as SavingsCard).currentBalance) ?? 0;
            const deduct = Math.min(cardBalance, remaining);
            if (deduct > 0) {
              cardUpdates.push({ ref: doc.ref, deducted: deduct });
              remaining -= deduct;
            }
          }
        }

        // ── Then all writes. FieldValue.increment applies atomically against whatever
        // the balance is at commit time, instead of overwriting with a value computed
        // from a stale pre-read — that's what let a concurrent balance change (e.g. a
        // payment confirming on the same card) get silently clobbered before. ──
        t.update(withdrawalRef, { status: "paid", paidAt: now });
        t.update(customerRef, { currentBalance: FieldValue.increment(-amount), updatedAt: now });
        for (const { ref, deducted } of cardUpdates) {
          t.update(ref, {
            currentBalance: FieldValue.increment(-deducted),
            // Tracks total withdrawn from this card — drives red-day display in classifyPeriods.
            migrationAmountWtd: FieldValue.increment(deducted),
            updatedAt: now,
          });
        }
      });
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_APPROVED") {
        return err("NOT_APPROVED", "Withdrawal must be approved first", 409);
      }
      throw e;
    }

    try {
      await writeAuditLog({
        action: "withdrawal.paid",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "withdrawals",
        before: { status: "approved", balance: customer.currentBalance },
        after: {
          status: "paid",
          amountDeducted: amount,
          cardUpdates: cardUpdates.map((u) => ({ id: u.ref.id, deducted: u.deducted })),
        },
        ipAddress: getIpFromRequest(req),
      });
    } catch (e) {
      console.error("writeAuditLog failed (non-fatal):", e);
    }

    try {
      await notifyWithdrawalPaid({
        customerUid: customer.uid,
        customerEmail: customer.email ?? "",
        amount,
        withdrawalId: params.id,
      });
    } catch (e) {
      console.error("notifyWithdrawalPaid failed (non-fatal):", e);
    }

    return ok({ message: "Withdrawal marked as paid" });
  });
}
