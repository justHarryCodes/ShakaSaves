export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound } from "@/lib/api-helpers";
import { getUpdateRequestById, reviewUpdateRequest } from "@/lib/firestore/contribution-updates";
import { getCustomerById } from "@/lib/firestore/customers";
import { notify } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const request = await getUpdateRequestById(params.id);
    if (!request) return notFound("Request not found");
    if (request.status !== "pending") return err("ALREADY_REVIEWED", "Already reviewed", 409);

    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!reason) return err("REASON_REQUIRED", "Rejection reason is required", 400);

    await reviewUpdateRequest(params.id, "rejected", decoded.uid, reason);

    const customer = await getCustomerById(request.customerId);
    if (customer) {
      await notify({
        recipientUid: customer.uid,
        recipientRole: "customer",
        title: "Contribution rate update declined",
        body: `Your request to change to ₦${request.requestedAmount.toLocaleString()}/day was declined. Reason: ${reason}`,
        type: "system",
        metadata: { requestId: params.id },
      });
    }

    return ok({ message: "Rejected" });
  });
}
