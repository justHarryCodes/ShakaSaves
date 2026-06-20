export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withFinancialAuth, withRole, ok, err, validationError, getIpFromRequest } from "@/lib/api-helpers";
import { submitPaymentSchema, paymentFilterSchema } from "@/schemas/payment.schema";
import { createPaymentSubmission, listPayments, getPaymentByIdempotencyKey } from "@/lib/firestore/payments";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { getCardById } from "@/lib/firestore/cards";
import { uploadImage } from "@/lib/cloudinary";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyPaymentSubmitted } from "@/lib/notifications";
import { FieldValue } from "firebase-admin/firestore";
import { auth } from "@/lib/firebase-admin";
import type { CardAllocation } from "@/types";

async function getAdminUid(): Promise<string> {
  try {
    const users = await auth.listUsers(1000);
    return users.users.find((u) => u.customClaims?.role === "admin")?.uid ?? "";
  } catch { return ""; }
}

export async function POST(req: NextRequest) {
  return withFinancialAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return err("MISSING_IDEMPOTENCY_KEY", "Idempotency-Key header required", 400);

    const existing = await getPaymentByIdempotencyKey(idempotencyKey);
    if (existing) return ok({ submissionId: existing.id, duplicate: true });

    const contentType = req.headers.get("content-type") ?? "";

    // ── New multi-card JSON path ──────────────────────────────────
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null) as {
        cardAllocations?: { cardId: string; amount: number }[];
        note?: string;
      } | null;

      if (!body?.cardAllocations?.length) {
        return err("INVALID_BODY", "cardAllocations required", 400);
      }

      const customer = await getCustomerByUid(decoded.uid);
      if (!customer) return err("NOT_FOUND", "Customer profile not found", 404);

      // Validate allocations and compute daysToMark per card
      const allocations: CardAllocation[] = [];
      let totalAmount = 0;

      for (const raw of body.cardAllocations) {
        if (typeof raw.cardId !== "string" || typeof raw.amount !== "number" || raw.amount <= 0) {
          return validationError("Each allocation needs cardId (string) and amount (positive number)");
        }
        const card = await getCardById(raw.cardId);
        if (!card) return err("NOT_FOUND", `Card ${raw.cardId} not found`, 404);
        if (card.customerId !== customer.id) return err("FORBIDDEN", "Card does not belong to you", 403);

        const dailyAmount = card.dailyAmount ?? card.contributionAmount ?? 1;
        allocations.push({
          cardId: raw.cardId,
          cardName: card.cardName ?? "Savings Card",
          amount: raw.amount,
          daysToMark: Math.floor(raw.amount / dailyAmount),
          daysOverride: null,
        });
        totalAmount += raw.amount;
      }

      const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
      const submissionId = await createPaymentSubmission({
        customerId: customer.id,
        customerName: customer.fullName,
        totalAmount,
        cardAllocations: allocations,
        status: "pending",
        submittedAt: now,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        idempotencyKey,
        note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
      });

      const adminUid = await getAdminUid();
      await Promise.all([
        writeAuditLog({
          action: "payment.submitted",
          performedBy: decoded.uid,
          performedByRole: "customer",
          targetId: submissionId,
          targetCollection: "payment_submissions",
          before: null,
          after: { submissionId, totalAmount, cardAllocations: allocations },
          ipAddress: getIpFromRequest(req),
        }),
        notifyPaymentSubmitted({
          adminUid,
          adminEmail: process.env.SENDGRID_FROM_EMAIL ?? "",
          customerName: customer.fullName,
          amount: totalAmount,
          periodsCount: allocations.length,
          submissionId,
          customerId: customer.id,
        }),
      ]);

      return ok({ submissionId }, 201);
    }

    // ── Legacy FormData path (proof image upload) ─────────────────
    const formData = await req.formData().catch(() => null);
    if (!formData) return err("INVALID_BODY", "Multipart form data required", 400);

    const proofFile = formData.get("proof") as File | null;
    if (!proofFile) return err("MISSING_PROOF", "Proof image is required", 400);

    if (!["image/jpeg", "image/png", "image/webp"].includes(proofFile.type)) {
      return err("INVALID_FILE_TYPE", "Only JPEG, PNG, and WebP are accepted", 415);
    }
    if (proofFile.size > 5 * 1024 * 1024) {
      return err("FILE_TOO_LARGE", "Max file size is 5MB", 413);
    }

    const rawData = {
      periods: JSON.parse(formData.get("periods") as string ?? "[]"),
      frequency: formData.get("frequency") as string,
      note: formData.get("note") as string | null,
    };

    const parsed = submitPaymentSchema.safeParse(rawData);
    if (!parsed.success) return validationError(parsed.error.message);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer profile not found", 404);

    const bytes = await proofFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const { url: proofImageUrl, publicId: proofPublicId } = await uploadImage(
      buffer,
      `payment-proofs/${customer.id}`
    );

    const amount = customer.contributionAmount * parsed.data.periods.length;
    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;

    const submissionId = await createPaymentSubmission({
      customerId: customer.id,
      customerName: customer.fullName,
      amount,
      periodsCount: parsed.data.periods.length,
      periods: parsed.data.periods,
      frequency: parsed.data.frequency,
      proofImageUrl,
      proofPublicId,
      status: "pending",
      submittedAt: now,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      idempotencyKey,
      note: parsed.data.note ?? null,
    });

    const adminUid = await getAdminUid();
    await Promise.all([
      writeAuditLog({
        action: "payment.submitted",
        performedBy: decoded.uid,
        performedByRole: "customer",
        targetId: submissionId,
        targetCollection: "payment_submissions",
        before: null,
        after: { submissionId, amount, periods: parsed.data.periods },
        ipAddress: getIpFromRequest(req),
      }),
      notifyPaymentSubmitted({
        adminUid,
        adminEmail: process.env.SENDGRID_FROM_EMAIL ?? "",
        customerName: customer.fullName,
        amount,
        periodsCount: parsed.data.periods.length,
        submissionId,
        customerId: customer.id,
      }),
    ]);

    return ok({ submissionId }, 201);
  });
}

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const { searchParams } = new URL(req.url);
    const parsed = paymentFilterSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return validationError(parsed.error.message);
    const { payments, nextCursor } = await listPayments(parsed.data);
    return ok({ payments, nextCursor });
  });
}
