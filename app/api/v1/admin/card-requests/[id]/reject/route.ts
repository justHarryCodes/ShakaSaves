export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound, getIpFromRequest } from "@/lib/api-helpers";
import { getCardRequestById, updateCardRequest } from "@/lib/firestore/card-requests";
import { getCustomerById } from "@/lib/firestore/customers";
import { notify } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/firestore/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const cardRequest = await getCardRequestById(params.id);
    if (!cardRequest) return notFound("Card request not found");
    if (cardRequest.status !== "pending") {
      return err("ALREADY_REVIEWED", "Card request already reviewed", 409);
    }

    const body = await req.json().catch(() => ({})) as { reason?: string };
    const reason = (body.reason ?? "").trim();
    if (!reason) return err("REASON_REQUIRED", "Rejection reason is required", 400);

    const customer = await getCustomerById(cardRequest.customerId);
    if (!customer) return notFound("Customer not found");

    await updateCardRequest(params.id, {
      status: "rejected",
      rejectionReason: reason,
    });

    await Promise.all([
      writeAuditLog({
        action: "card_request.rejected",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "card_requests",
        before: { status: "pending" },
        after: { status: "rejected", reason },
        ipAddress: getIpFromRequest(req),
      }),
      notify({
        recipientUid: customer.uid,
        recipientRole: "customer",
        title: "Card request not approved",
        body: `Your request for "${cardRequest.cardName}" was not approved. Reason: ${reason}`,
        type: "card_request",
        metadata: { requestId: params.id },
      }),
    ]);

    return ok({ message: "Card request rejected" });
  });
}
