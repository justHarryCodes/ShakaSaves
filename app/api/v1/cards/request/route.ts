export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, validationError, getIpFromRequest } from "@/lib/api-helpers";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { createCardRequest, getPendingRequestByCustomer, listCardRequestsByCustomer } from "@/lib/firestore/card-requests";
import { uploadImage } from "@/lib/cloudinary";
import { notify } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/firestore/audit";
import { FieldValue } from "firebase-admin/firestore";
import { auth } from "@/lib/firebase-admin";

async function getAdminUid(): Promise<string> {
  try {
    const users = await auth.listUsers(1000);
    return users.users.find((u) => u.customClaims?.role === "admin")?.uid ?? "";
  } catch { return ""; }
}

// GET /api/v1/cards/request — customer fetches their own card requests
export async function GET(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);
    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer profile not found", 404);
    const requests = await listCardRequestsByCustomer(customer.id);
    return ok({ requests });
  });
}

// POST /api/v1/cards/request — customer submits a card request with first payment proof
export async function POST(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer profile not found", 404);

    const pending = await getPendingRequestByCustomer(customer.id);
    if (pending) {
      return err("ALREADY_PENDING", "You already have a pending card request. Wait for admin review.", 409);
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) return err("INVALID_BODY", "Form data required", 400);

    const cardName = ((formData.get("cardName") as string | null) ?? "").trim();
    const dailyAmount = Number(formData.get("dailyAmount"));
    const firstPaymentAmount = Number(formData.get("firstPaymentAmount"));
    const proofFile = formData.get("proof") as File | null;

    if (!cardName || cardName.length > 60) {
      return validationError("Card name must be 1–60 characters");
    }
    if (!Number.isFinite(dailyAmount) || dailyAmount <= 0) {
      return validationError("Daily amount must be a positive number");
    }
    if (!Number.isFinite(firstPaymentAmount) || firstPaymentAmount <= 0) {
      return validationError("First payment amount must be a positive number");
    }
    if (firstPaymentAmount < dailyAmount) {
      return validationError(`First payment must cover at least 1 day (minimum ₦${dailyAmount})`);
    }
    if (!proofFile) return err("MISSING_PROOF", "Payment proof image is required", 400);
    if (!["image/jpeg", "image/png", "image/webp"].includes(proofFile.type)) {
      return err("INVALID_FILE_TYPE", "Only JPEG, PNG, and WebP are accepted", 415);
    }
    if (proofFile.size > 5 * 1024 * 1024) {
      return err("FILE_TOO_LARGE", "Max file size is 5MB", 413);
    }

    const bytes = await proofFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const { url: proofImageUrl, publicId: proofPublicId } = await uploadImage(
      buffer,
      `card-request-proofs/${customer.id}`
    );

    const daysToMark = Math.floor(firstPaymentAmount / dailyAmount);
    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;

    const requestId = await createCardRequest({
      customerId: customer.id,
      customerName: customer.fullName,
      cardName,
      dailyAmount,
      firstPaymentAmount,
      daysToMark,
      proofImageUrl,
      proofPublicId,
      status: "pending",
      rejectionReason: null,
      cardId: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const adminUid = await getAdminUid();
    const naira = (n: number) =>
      new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

    await Promise.all([
      writeAuditLog({
        action: "card_request.submitted",
        performedBy: decoded.uid,
        performedByRole: "customer",
        targetId: requestId,
        targetCollection: "card_requests",
        before: null,
        after: { requestId, cardName, dailyAmount, firstPaymentAmount, daysToMark },
        ipAddress: getIpFromRequest(req),
      }),
      adminUid
        ? notify({
            recipientUid: adminUid,
            recipientRole: "admin",
            title: "New card request",
            body: `${customer.fullName} requested "${cardName}" — ${naira(dailyAmount)}/day, first payment ${naira(firstPaymentAmount)} (${daysToMark} day${daysToMark !== 1 ? "s" : ""})`,
            type: "card_request",
            metadata: { requestId, customerId: customer.id },
          })
        : Promise.resolve(),
    ]);

    return ok({ requestId }, 201);
  });
}
