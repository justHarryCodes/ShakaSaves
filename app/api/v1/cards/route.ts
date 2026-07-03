export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err } from "@/lib/api-helpers";
import { listCardsByCustomer } from "@/lib/firestore/cards";
import { getCustomerByUid } from "@/lib/firestore/customers";

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

// Cards are now created via the request-approval flow. Direct creation is not permitted.
export async function POST() {
  return err("METHOD_NOT_ALLOWED", "Use POST /api/v1/cards/request to request a card.", 405);
}
