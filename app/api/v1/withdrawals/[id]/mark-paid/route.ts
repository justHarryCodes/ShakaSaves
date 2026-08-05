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

    // Fetch all savings cards ordered oldest-first (migrated cards predate new ones)
    // so deductions always drain migrated cards before new ones — predictable & consistent.
    const cardsSnap = await db.collection("savings_cards")
      .where("customerId", "==", withdrawal.customerId)
      .orderBy("createdAt", "asc")
      .get();

    let remaining = amount;
    const cardUpdates: { ref: FirebaseFirestore.DocumentReference; newBalance: number; deducted: number }[] = [];

    for (const doc of cardsSnap.docs) {
      if (remaining <= 0) break;
      const cardBalance = ((doc.data() as SavingsCard).currentBalance) ?? 0;
      const deduct = Math.min(cardBalance, remaining);
      if (deduct > 0) {
        cardUpdates.push({
          ref: doc.ref,
          newBalance: Math.max(0, cardBalance - deduct),
          deducted: deduct,
        });
        remaining -= deduct;
      }
    }

    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;

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
          // Tracks total withdrawn from this card — used by classifyPeriods to paint red days.
          // FieldValue.increment creates the field if it doesn't exist yet (new cards start at 0).
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
          cardUpdates: cardUpdates.map((u) => ({ id: u.ref.id, newBalance: u.newBalance })),
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
