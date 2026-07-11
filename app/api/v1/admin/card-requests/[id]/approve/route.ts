export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound, serverError, getIpFromRequest } from "@/lib/api-helpers";
import { getCardRequestById } from "@/lib/firestore/card-requests";
import { getCustomerById } from "@/lib/firestore/customers";
import { createContributions } from "@/lib/firestore/contributions";
import { notify } from "@/lib/notifications";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

function generateDates(count: number, startFrom: "today" | "january"): string[] {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  if (startFrom === "january") {
    start.setUTCMonth(0);
    start.setUTCDate(1);
  }
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const cardRequest = await getCardRequestById(params.id);
    if (!cardRequest) return notFound("Card request not found");
    if (cardRequest.status !== "pending") {
      return err("ALREADY_REVIEWED", "Card request already reviewed", 409);
    }

    const customer = await getCustomerById(cardRequest.customerId);
    if (!customer) return notFound("Customer not found");

    const body = await req.json().catch(() => ({}));
    const startFrom: "today" | "january" = body?.startFrom === "january" ? "january" : "today";
    const periods = generateDates(cardRequest.daysToMark, startFrom);
    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const ipAddress = getIpFromRequest(req);

    // Create the card ref before the transaction so we have the ID
    const cardRef = db.collection("savings_cards").doc();
    const cardId = cardRef.id;
    const requestRef = db.collection("card_requests").doc(params.id);
    const customerRef = db.collection("customers").doc(cardRequest.customerId);

    const tx = db.runTransaction(async (t) => {
      // Create the savings card
      t.set(cardRef, {
        customerId: cardRequest.customerId,
        customerName: cardRequest.customerName,
        cardName: cardRequest.cardName,
        dailyAmount: cardRequest.dailyAmount,
        tickedPeriods: periods,
        currentBalance: cardRequest.firstPaymentAmount,
        createdAt: now,
        updatedAt: now,
      });

      // Mark card request as approved
      t.update(requestRef, {
        status: "approved",
        cardId,
        approvedBy: decoded.uid,
        approvedAt: now,
        updatedAt: now,
      });

      // Credit customer balance
      t.update(customerRef, {
        currentBalance: FieldValue.increment(cardRequest.firstPaymentAmount),
        updatedAt: now,
      });

      // Create contribution record
      await createContributions(
        [
          {
            customerId: cardRequest.customerId,
            cardId,
            cardName: cardRequest.cardName,
            submissionId: params.id,
            amount: cardRequest.firstPaymentAmount,
            daysMarked: cardRequest.daysToMark,
            periodsMarked: periods,
            period: periods[0] ?? "",
            confirmedAt: now,
            confirmedBy: decoded.uid,
            deletedAt: null,
          },
        ],
        t
      );

      // Audit log
      const auditRef = db.collection("audit_logs").doc();
      t.set(auditRef, {
        action: "card_request.approved",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "card_requests",
        before: { status: "pending" },
        after: {
          status: "approved",
          cardId,
          firstPaymentAmount: cardRequest.firstPaymentAmount,
          daysToMark: cardRequest.daysToMark,
        },
        timestamp: now,
        ipAddress,
      });
    });

    try {
      await tx;
    } catch (e) {
      console.error("Card request approval transaction failed", e);
      return serverError("Failed to approve card request");
    }

    const naira = (n: number) =>
      new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

    await notify({
      recipientUid: customer.uid,
      recipientRole: "customer",
      title: "Card request approved!",
      body: `Your "${cardRequest.cardName}" savings card has been created. First payment of ${naira(cardRequest.firstPaymentAmount)} credited — ${cardRequest.daysToMark} day${cardRequest.daysToMark !== 1 ? "s" : ""} marked.`,
      type: "card_request",
      metadata: { requestId: params.id, cardId },
    });

    return ok({ cardId });
  });
}
