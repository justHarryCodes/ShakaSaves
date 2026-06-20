export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, validationError } from "@/lib/api-helpers";
import { createCard, listCardsByCustomer } from "@/lib/firestore/cards";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { FieldValue } from "firebase-admin/firestore";

// GET /api/v1/cards — customer lists their own cards
export async function GET(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);
    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer profile not found", 404);
    const cards = await listCardsByCustomer(customer.id);
    return ok({ cards });
  });
}

// POST /api/v1/cards — customer creates a new savings card
export async function POST(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const body = await req.json().catch(() => null);
    if (!body) return err("INVALID_BODY", "JSON body required", 400);

    const { cardName, dailyAmount } = body as { cardName?: unknown; dailyAmount?: unknown };

    if (typeof cardName !== "string" || cardName.trim().length < 1 || cardName.trim().length > 60) {
      return validationError("cardName must be 1–60 characters");
    }
    if (typeof dailyAmount !== "number" || dailyAmount <= 0 || !Number.isFinite(dailyAmount)) {
      return validationError("dailyAmount must be a positive number");
    }

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer profile not found", 404);

    const cardId = await createCard({
      customerId: customer.id,
      customerName: customer.fullName,
      cardName: cardName.trim(),
      dailyAmount,
      tickedPeriods: [],
      currentBalance: 0,
      createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    });

    return ok({ cardId }, 201);
  });
}
