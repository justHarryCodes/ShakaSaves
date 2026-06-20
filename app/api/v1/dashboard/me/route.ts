export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err } from "@/lib/api-helpers";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { listCustomerPayments } from "@/lib/firestore/payments";
import { listCardsByCustomer } from "@/lib/firestore/cards";
import { getContributionsByCustomer } from "@/lib/firestore/contributions";

export async function GET(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer profile not found", 404);

    const [payments, cards, contributions] = await Promise.all([
      listCustomerPayments(customer.id),
      listCardsByCustomer(customer.id),
      getContributionsByCustomer(customer.id),
    ]);

    return ok({
      customer,
      recentPayments: payments.slice(0, 5),
      cards,
      contributions,
    });
  });
}
