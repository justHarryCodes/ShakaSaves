export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound } from "@/lib/api-helpers";
import { getWithdrawalById, updateWithdrawal } from "@/lib/firestore/withdrawals";
import { getCustomerById } from "@/lib/firestore/customers";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWithdrawalApproved } from "@/lib/notifications";
import { getIpFromRequest } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const withdrawal = await getWithdrawalById(params.id);
    if (!withdrawal) return notFound("Withdrawal not found");
    if (withdrawal.status !== "pending") return err("ALREADY_REVIEWED", "Already reviewed", 409);

    const customer = await getCustomerById(withdrawal.customerId);
    if (!customer) return notFound("Customer not found");

    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    await updateWithdrawal(params.id, { status: "approved", reviewedBy: decoded.uid, reviewedAt: now });

    await Promise.all([
      writeAuditLog({
        action: "withdrawal.approved",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "withdrawals",
        before: { status: "pending" },
        after: { status: "approved" },
        ipAddress: getIpFromRequest(req),
      }),
      notifyWithdrawalApproved({
        customerUid: customer.uid,
        customerEmail: customer.email ?? "",
        amount: withdrawal.amountRequested,
        withdrawalId: params.id,
      }),
    ]);

    return ok({ message: "Withdrawal approved" });
  });
}
