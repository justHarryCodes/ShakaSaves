export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, notFound } from "@/lib/api-helpers";
import { getPaymentById } from "@/lib/firestore/payments";
import { getCustomerByUid } from "@/lib/firestore/customers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(req, async (decoded) => {
    const payment = await getPaymentById(params.id);
    if (!payment) return notFound("Payment not found");

    if (decoded.role !== "admin") {
      const customer = await getCustomerByUid(decoded.uid);
      if (!customer || customer.id !== payment.customerId) {
        return err("FORBIDDEN", "Access denied", 403);
      }
    }

    return ok({ payment });
  });
}
