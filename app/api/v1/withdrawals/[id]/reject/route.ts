export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound, validationError } from "@/lib/api-helpers";
import { getWithdrawalById, updateWithdrawal } from "@/lib/firestore/withdrawals";
import { getCustomerById } from "@/lib/firestore/customers";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWithdrawalRejected } from "@/lib/notifications";
import { rejectWithdrawalSchema } from "@/schemas/withdrawal.schema";
import { getIpFromRequest } from "@/lib/redis";
import { FieldValue } from "firebase-admin/firestore";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const withdrawal = await getWithdrawalById(params.id);
    if (!withdrawal) return notFound("Withdrawal not found");
    if (withdrawal.status !== "pending") return err("ALREADY_REVIEWED", "Already reviewed", 409);

    const body = await req.json().catch(() => null);
    const parsed = rejectWithdrawalSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const customer = await getCustomerById(withdrawal.customerId);
    if (!customer) return notFound("Customer not found");

    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    await updateWithdrawal(params.id, {
      status: "rejected",
      reviewedBy: decoded.uid,
      reviewedAt: now,
      rejectionReason: parsed.data.rejectionReason,
    });

    await Promise.all([
      writeAuditLog({
        action: "withdrawal.rejected",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "withdrawals",
        before: { status: "pending" },
        after: { status: "rejected", rejectionReason: parsed.data.rejectionReason },
        ipAddress: getIpFromRequest(req),
      }),
      notifyWithdrawalRejected({
        customerUid: customer.uid,
        customerEmail: customer.email,
        amount: withdrawal.amountRequested,
        reason: parsed.data.rejectionReason,
        withdrawalId: params.id,
      }),
    ]);

    return ok({ message: "Withdrawal rejected" });
  });
}
