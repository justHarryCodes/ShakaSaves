export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound } from "@/lib/api-helpers";
import { getWithdrawalById, updateWithdrawal } from "@/lib/firestore/withdrawals";
import { getCustomerById, updateCustomer } from "@/lib/firestore/customers";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWithdrawalPaid } from "@/lib/notifications";
import { getIpFromRequest } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const withdrawal = await getWithdrawalById(params.id);
    if (!withdrawal) return notFound("Withdrawal not found");
    if (withdrawal.status !== "approved") return err("NOT_APPROVED", "Withdrawal must be approved first", 409);

    const customer = await getCustomerById(withdrawal.customerId);
    if (!customer) return notFound("Customer not found");

    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    await updateWithdrawal(params.id, { status: "paid", paidAt: now });

    // Deduct from customer balance
    const newBalance = Math.max(0, (customer.currentBalance ?? 0) - withdrawal.amountRequested);
    await updateCustomer(withdrawal.customerId, { currentBalance: newBalance });

    await Promise.all([
      writeAuditLog({
        action: "withdrawal.paid",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "withdrawals",
        before: { status: "approved", balance: customer.currentBalance },
        after: { status: "paid", newBalance },
        ipAddress: getIpFromRequest(req),
      }),
      notifyWithdrawalPaid({
        customerUid: customer.uid,
        customerEmail: customer.email,
        amount: withdrawal.amountRequested,
        withdrawalId: params.id,
      }),
    ]);

    return ok({ message: "Withdrawal marked as paid" });
  });
}
