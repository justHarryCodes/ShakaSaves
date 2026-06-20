export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withFinancialAuth, ok, err, notFound, validationError } from "@/lib/api-helpers";
import { getPaymentById, updatePaymentStatus } from "@/lib/firestore/payments";
import { getCustomerById } from "@/lib/firestore/customers";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyPaymentRejected } from "@/lib/notifications";
import { rejectPaymentSchema } from "@/schemas/payment.schema";
import { getIpFromRequest } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withFinancialAuth(req, async (decoded) => {
    if (decoded.role !== "admin") return err("FORBIDDEN", "Admin only", 403);

    const payment = await getPaymentById(params.id);
    if (!payment) return notFound("Payment not found");
    if (payment.status !== "pending") return err("ALREADY_REVIEWED", "Payment already reviewed", 409);

    const body = await req.json().catch(() => null);
    const parsed = rejectPaymentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const customer = await getCustomerById(payment.customerId);
    if (!customer) return notFound("Customer not found");

    await updatePaymentStatus(params.id, "rejected", decoded.uid, parsed.data.rejectionReason);

    await Promise.all([
      writeAuditLog({
        action: "payment.rejected",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "payment_submissions",
        before: { status: "pending" },
        after: { status: "rejected", rejectionReason: parsed.data.rejectionReason },
        ipAddress: getIpFromRequest(req),
      }),
      notifyPaymentRejected({
        customerUid: customer.uid,
        customerEmail: customer.email,
        amount: payment.totalAmount ?? payment.amount ?? 0,
        reason: parsed.data.rejectionReason,
        submissionId: params.id,
      }),
    ]);

    return ok({ message: "Payment rejected" });
  });
}
