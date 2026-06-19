export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withFinancialAuth, ok, err, notFound, serverError } from "@/lib/api-helpers";
import { getPaymentById } from "@/lib/firestore/payments";
import { getCustomerById } from "@/lib/firestore/customers";
import { createContributions } from "@/lib/firestore/contributions";
import { addTickedPeriods, upsertCard } from "@/lib/firestore/cards";
import { notifyPaymentConfirmed } from "@/lib/notifications";
import { generateSavingsCardImage } from "@/lib/card-generator";
import { uploadImage } from "@/lib/cloudinary";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getIpFromRequest } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withFinancialAuth(req, async (decoded) => {
    if (decoded.role !== "admin") return err("FORBIDDEN", "Admin only", 403);

    const payment = await getPaymentById(params.id);
    if (!payment) return notFound("Payment not found");
    if (payment.status !== "pending") return err("ALREADY_REVIEWED", "Payment already reviewed", 409);

    const customer = await getCustomerById(payment.customerId);
    if (!customer) return notFound("Customer not found");

    const confirmedAt = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const perPeriodAmount = payment.amount / payment.periodsCount;

    const contributions = payment.periods.map((period) => ({
      customerId: payment.customerId,
      submissionId: params.id,
      amount: perPeriodAmount,
      period,
      frequency: payment.frequency,
      confirmedAt,
      confirmedBy: decoded.uid,
      deletedAt: null,
    }));

    // Atomic batch write
    const tx = db.runTransaction(async (t) => {
      const paymentRef = db.collection("payment_submissions").doc(params.id);
      const customerRef = db.collection("customers").doc(payment.customerId);

      t.update(paymentRef, {
        status: "confirmed",
        reviewedBy: decoded.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        rejectionReason: null,
      });

      t.update(customerRef, {
        currentBalance: FieldValue.increment(payment.amount),
        pendingBalance: FieldValue.increment(-payment.amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await createContributions(contributions, t);
      await addTickedPeriods(payment.customerId, payment.periods, t);

      const auditRef = db.collection("audit_logs").doc();
      t.set(auditRef, {
        action: "payment.confirmed",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "payment_submissions",
        before: { status: "pending" },
        after: { status: "confirmed", amount: payment.amount, periods: payment.periods },
        timestamp: FieldValue.serverTimestamp(),
        ipAddress: getIpFromRequest(req),
      });
    });

    try {
      await tx;
    } catch (e) {
      console.error("Confirm payment transaction failed", e);
      return serverError("Failed to confirm payment");
    }

    // Regenerate savings card
    try {
      const now = new Date();
      const cardData = {
        customerName: customer.fullName,
        contributionAmount: customer.contributionAmount,
        frequency: customer.contributionFrequency,
        monthlyTarget: customer.monthlyTarget,
        cycleYear: now.getFullYear(),
        cycleMonth: now.getMonth() + 1,
        tickedPeriods: payment.periods,
        currentBalance: (customer.currentBalance ?? 0) + payment.amount,
      };

      const cardBuffer = await generateSavingsCardImage(cardData, customer.id);
      const { url: cardImageUrl, publicId: cardPublicId } = await uploadImage(
        cardBuffer,
        "savings-cards",
        `card-${customer.id}`
      );

      await upsertCard(customer.id, {
        customerName: customer.fullName,
        contributionAmount: customer.contributionAmount,
        frequency: customer.contributionFrequency,
        monthlyTarget: customer.monthlyTarget,
        cycleYear: now.getFullYear(),
        cycleMonth: now.getMonth() + 1,
        totalSlots: payment.frequency === "daily" ? 31 : payment.frequency === "weekly" ? 5 : 12,
        tickedPeriods: payment.periods,
        currentBalance: (customer.currentBalance ?? 0) + payment.amount,
        cardImageUrl,
        cardPublicId,
      });
    } catch (e) {
      console.error("Card regeneration failed (non-fatal)", e);
    }

    await notifyPaymentConfirmed({
      customerUid: customer.uid,
      customerEmail: customer.email,
      amount: payment.amount,
      periodsCount: payment.periodsCount,
      submissionId: params.id,
    });

    return ok({ message: "Payment confirmed" });
  });
}
