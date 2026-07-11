export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err } from "@/lib/api-helpers";
import { getCustomerByUid, updateCustomer } from "@/lib/firestore/customers";
import { createUpdateRequest, getCustomerPendingRequest } from "@/lib/firestore/contribution-updates";
import { FieldValue } from "firebase-admin/firestore";

function isEndOfMonth(): boolean {
  const today = new Date();
  return today.getDate() >= 25;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);
    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer not found", 404);
    const pending = await getCustomerPendingRequest(customer.id);
    return ok({ pending, canRequest: isEndOfMonth(), currentAmount: customer.contributionAmount });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    if (!isEndOfMonth()) {
      return err("TOO_EARLY", "Contribution amount updates can only be requested from the 25th of each month", 400);
    }

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer not found", 404);

    const existing = await getCustomerPendingRequest(customer.id);
    if (existing) return err("ALREADY_PENDING", "You already have a pending contribution update request", 409);

    const body = await req.json().catch(() => null);
    const requestedAmount = typeof body?.requestedAmount === "number" ? body.requestedAmount : 0;

    if (requestedAmount <= 0) return err("INVALID_AMOUNT", "Amount must be greater than 0", 400);
    if (requestedAmount === customer.contributionAmount) {
      return err("SAME_AMOUNT", "Requested amount is the same as your current rate", 400);
    }

    const id = await createUpdateRequest({
      customerId: customer.id,
      customerName: customer.fullName,
      currentAmount: customer.contributionAmount,
      requestedAmount,
      status: "pending",
      requestedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    });

    return ok({ requestId: id }, 201);
  });
}
