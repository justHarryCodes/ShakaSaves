export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withFinancialAuth, ok, err, notFound, serverError, getIpFromRequest } from "@/lib/api-helpers";
import { getPaymentById, updatePaymentStatus } from "@/lib/firestore/payments";
import { getCustomerById } from "@/lib/firestore/customers";
import { createContributions } from "@/lib/firestore/contributions";
import { addTickedPeriods, applyCardAllocation, getCardById } from "@/lib/firestore/cards";
import { notifyPaymentConfirmed } from "@/lib/notifications";
import { generateSavingsCardImage } from "@/lib/card-generator";
import { uploadImage } from "@/lib/cloudinary";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Generates N consecutive "YYYY-MM-DD" dates continuing from the last ticked period.
function generateNextDates(sortedTickedPeriods: string[], count: number): string[] {
  if (count <= 0) return [];
  let startDate: Date;
  if (sortedTickedPeriods.length > 0) {
    startDate = new Date(sortedTickedPeriods[sortedTickedPeriods.length - 1] + "T00:00:00Z");
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  } else {
    startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
  }
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withFinancialAuth(req, async (decoded) => {
    if (decoded.role !== "admin") return err("FORBIDDEN", "Admin only", 403);

    const payment = await getPaymentById(params.id);
    if (!payment) return notFound("Payment not found");
    if (payment.status !== "pending") return err("ALREADY_REVIEWED", "Payment already reviewed", 409);

    const customer = await getCustomerById(payment.customerId);
    if (!customer) return notFound("Customer not found");

    // Parse optional admin overrides: { [cardId]: numberOfDays }
    const body = await req.json().catch(() => ({})) as { overrides?: Record<string, number> };
    const overrides: Record<string, number> = body.overrides ?? {};

    const confirmedAt = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const ipAddress = getIpFromRequest(req);

    // ── New multi-card format ─────────────────────────────────────
    if (payment.cardAllocations?.length) {
      // Pre-fetch all cards so we know their current tickedPeriods
      const cardSnapshots = await Promise.all(
        payment.cardAllocations.map((a) => getCardById(a.cardId))
      );

      const contributions: Parameters<typeof createContributions>[0] = [];
      const allocationDetails: { cardId: string; days: number; periods: string[]; amount: number }[] = [];

      for (let i = 0; i < payment.cardAllocations.length; i++) {
        const allocation = payment.cardAllocations[i];
        const card = cardSnapshots[i];
        if (!card) continue;

        const days = overrides[allocation.cardId] ?? allocation.daysOverride ?? allocation.daysToMark;
        const sortedExisting = (card.tickedPeriods ?? []).slice().sort();
        const newPeriods = generateNextDates(sortedExisting, days);

        allocationDetails.push({ cardId: allocation.cardId, days, periods: newPeriods, amount: allocation.amount });

        contributions.push({
          customerId: payment.customerId,
          cardId: allocation.cardId,
          cardName: allocation.cardName,
          submissionId: params.id,
          amount: allocation.amount,
          daysMarked: days,
          periodsMarked: newPeriods,
          period: newPeriods[0] ?? "",
          confirmedAt,
          confirmedBy: decoded.uid,
          deletedAt: null,
        });
      }

      const totalAmount = payment.totalAmount ?? 0;

      const tx = db.runTransaction(async (t) => {
        const paymentRef = db.collection("payment_submissions").doc(params.id);
        const customerRef = db.collection("customers").doc(payment.customerId);

        t.update(paymentRef, {
          status: "confirmed",
          reviewedBy: decoded.uid,
          reviewedAt: FieldValue.serverTimestamp(),
          rejectionReason: null,
          // Persist overrides back onto the allocations for the record
          cardAllocations: payment.cardAllocations!.map((a) => ({
            ...a,
            daysOverride: overrides[a.cardId] ?? a.daysOverride,
          })),
        });

        t.update(customerRef, {
          currentBalance: FieldValue.increment(totalAmount),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await createContributions(contributions, t);

        for (const detail of allocationDetails) {
          await applyCardAllocation(detail.cardId, detail.periods, detail.amount, t);
        }

        const auditRef = db.collection("audit_logs").doc();
        t.set(auditRef, {
          action: "payment.confirmed",
          performedBy: decoded.uid,
          performedByRole: "admin",
          targetId: params.id,
          targetCollection: "payment_submissions",
          before: { status: "pending" },
          after: { status: "confirmed", totalAmount, allocationDetails },
          timestamp: FieldValue.serverTimestamp(),
          ipAddress,
        });
      });

      try { await tx; } catch (e) {
        console.error("Confirm payment transaction failed", e);
        return serverError("Failed to confirm payment");
      }

      await notifyPaymentConfirmed({
        customerUid: customer.uid,
        customerEmail: customer.email ?? "",
        amount: totalAmount,
        periodsCount: allocationDetails.reduce((s, d) => s + d.days, 0),
        submissionId: params.id,
      });

      return ok({ message: "Payment confirmed" });
    }

    // ── Legacy single-card format ─────────────────────────────────
    const amount = payment.amount ?? 0;
    const perPeriodAmount = payment.periodsCount ? amount / payment.periodsCount : 0;
    const periods = payment.periods ?? [];

    const legacyContributions = periods.map((period) => ({
      customerId: payment.customerId,
      submissionId: params.id,
      amount: perPeriodAmount,
      period,
      frequency: payment.frequency,
      confirmedAt,
      confirmedBy: decoded.uid,
      deletedAt: null,
    }));

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
        currentBalance: FieldValue.increment(amount),
        pendingBalance: FieldValue.increment(-amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await createContributions(legacyContributions, t);
      await addTickedPeriods(payment.customerId, periods, t);

      const auditRef = db.collection("audit_logs").doc();
      t.set(auditRef, {
        action: "payment.confirmed",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: params.id,
        targetCollection: "payment_submissions",
        before: { status: "pending" },
        after: { status: "confirmed", amount, periods },
        timestamp: FieldValue.serverTimestamp(),
        ipAddress,
      });
    });

    try { await tx; } catch (e) {
      console.error("Confirm payment transaction failed", e);
      return serverError("Failed to confirm payment");
    }

    // Regenerate legacy savings card image
    try {
      const now = new Date();
      const cardData = {
        customerName: customer.fullName,
        contributionAmount: customer.contributionAmount,
        frequency: customer.contributionFrequency,
        monthlyTarget: customer.monthlyTarget,
        cycleYear: now.getFullYear(),
        cycleMonth: now.getMonth() + 1,
        tickedPeriods: periods,
        currentBalance: (customer.currentBalance ?? 0) + amount,
      };
      const cardBuffer = await generateSavingsCardImage(cardData, customer.id);
      const { url: cardImageUrl, publicId: cardPublicId } = await uploadImage(cardBuffer, "savings-cards", `card-${customer.id}`);
      const { upsertCard } = await import("@/lib/firestore/cards");
      await upsertCard(customer.id, {
        customerName: customer.fullName,
        contributionAmount: customer.contributionAmount,
        frequency: customer.contributionFrequency,
        monthlyTarget: customer.monthlyTarget,
        cycleYear: now.getFullYear(),
        cycleMonth: now.getMonth() + 1,
        totalSlots: payment.frequency === "daily" ? 31 : payment.frequency === "weekly" ? 5 : 12,
        tickedPeriods: periods,
        currentBalance: (customer.currentBalance ?? 0) + amount,
        cardImageUrl,
        cardPublicId,
      });
    } catch (e) { console.error("Card regeneration failed (non-fatal)", e); }

    await notifyPaymentConfirmed({
      customerUid: customer.uid,
      customerEmail: customer.email ?? "",
      amount,
      periodsCount: periods.length,
      submissionId: params.id,
    });

    return ok({ message: "Payment confirmed" });
  });
}
