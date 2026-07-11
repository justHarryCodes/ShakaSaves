export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound, serverError, getIpFromRequest } from "@/lib/api-helpers";
import { getUpdateRequestById, reviewUpdateRequest } from "@/lib/firestore/contribution-updates";
import { getCustomerById } from "@/lib/firestore/customers";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { notify } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const request = await getUpdateRequestById(params.id);
    if (!request) return notFound("Request not found");
    if (request.status !== "pending") return err("ALREADY_REVIEWED", "Already reviewed", 409);

    const customer = await getCustomerById(request.customerId);
    if (!customer) return notFound("Customer not found");

    const customerRef = db.collection("customers").doc(request.customerId);
    const requestRef = db.collection("contribution_update_requests").doc(params.id);
    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const auditRef = db.collection("audit_logs").doc();

    try {
      await db.runTransaction(async (t) => {
        t.update(customerRef, { contributionAmount: request.requestedAmount, updatedAt: now });
        t.update(requestRef, {
          status: "approved",
          reviewedBy: decoded.uid,
          reviewedAt: now,
          rejectionReason: null,
        });
        t.set(auditRef, {
          action: "contribution_update.approved",
          performedBy: decoded.uid,
          performedByRole: "admin",
          targetId: params.id,
          targetCollection: "contribution_update_requests",
          before: { contributionAmount: request.currentAmount },
          after: { contributionAmount: request.requestedAmount },
          timestamp: now,
          ipAddress: getIpFromRequest(req),
        });
      });
    } catch (e) {
      console.error("Contribution update approval failed", e);
      return serverError("Failed to approve update");
    }

    const naira = (n: number) =>
      new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

    await notify({
      recipientUid: customer.uid,
      recipientRole: "customer",
      title: "Contribution rate updated",
      body: `Your daily contribution rate has been updated to ${naira(request.requestedAmount)}/day starting next month.`,
      type: "system",
      metadata: { requestId: params.id },
    });

    return ok({ message: "Approved" });
  });
}
