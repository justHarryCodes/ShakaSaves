export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err } from "@/lib/api-helpers";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { listCustomerPayments } from "@/lib/firestore/payments";

export async function GET(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);
    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer not found", 404);
    const payments = await listCustomerPayments(customer.id);
    return ok({ payments });
  });
}
