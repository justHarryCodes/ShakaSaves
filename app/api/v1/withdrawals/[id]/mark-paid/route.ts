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
    const newCustomerBalance = Math.max(0, (customer.currentBalance ?? 0) - amount);
    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;

    type CardUpdate = { ref: FirebaseFirestore.DocumentReference; newBalance: number; deducted: number };
    let cardUpdates: CardUpdate[] = [];

    if (withdrawal.cardSelections && withdrawal.cardSelections.length > 0) {
      // ── New path: exact per-card deduction from user's selection ────
      // Fetch each card individually by ID — no query, no index needed.
      const cardDocs = await Promise.all(
        withdrawal.cardSelections.map((sel) =>
          db.collection("savings_cards").doc(sel.cardId).get()
        )
      );

      for (let i = 0; i < withdrawal.cardSelections.length; i++) {
        const sel = withdrawal.cardSelections[i];
        const doc = cardDocs[i];
        if (!doc.exists) continue; // card deleted — skip gracefully
        const currentBalance = ((doc.data() as SavingsCard).currentBalance) ?? 0;
        cardUpdates.push({
          ref: doc.ref,
          newBalance: Math.max(0, currentBalance - sel.amountFromCard),
          deducted: sel.amountFromCard,
        });
      }
    } else {
      // ── Legacy path: sequential deduction across cards (oldest first) ─
      const cardsSnap = await db.collection("savings_cards")
        .where("customerId", "==", withdrawal.customerId)
        .get();

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
          cardUpdates.push({ ref: doc.ref, newBalance: Math.max(0, cardBalance - deduct), deducted: deduct });
          remaining -= deduct;
        }
      }
    }

    await db.runTransaction(async (t) => {
      t.update(db.collection("withdrawals").doc(params.id), {
        status: "paid",
        paidAt: now,
      });
      t.update(db.collection("customers").doc(withdrawal.customerId), {
        currentBalance: newCustomerBalance,
        updatedAt: now,
      });
      for (const { ref, newBalance, deducted } of cardUpdates) {
        t.update(ref, {
          currentBalance: newBalance,
          // Tracks total withdrawn from this card — drives red-day display in classifyPeriods.
          // FieldValue.increment creates the field from 0 if it doesn't exist yet.
          migrationAmountWtd: FieldValue.increment(deducted),
          updatedAt: now,
        });
      }
    });

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
          newCustomerBalance,
          cardUpdates: cardUpdates.map((u) => ({ id: u.ref.id, newBalance: u.newBalance, deducted: u.deducted })),
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
