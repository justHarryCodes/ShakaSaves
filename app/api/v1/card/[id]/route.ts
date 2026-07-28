export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, notFound } from "@/lib/api-helpers";
import { getCardById } from "@/lib/firestore/cards";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";

// GET /api/v1/card/[id] — customer fetches one of their own cards by Firestore doc ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return notFound("Customer not found");

    const card = await getCardById(params.id);
    if (!card) return notFound("Card not found");
    if (card.customerId !== customer.id) return err("FORBIDDEN", "Access denied", 403);

    const plans = await listActivePlans();
    const plan = plans.find((p) => p.name.toLowerCase() === (card.category ?? "").toLowerCase()) ?? null;

    return ok({ card, plan });
  });
}
