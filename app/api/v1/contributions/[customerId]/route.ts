export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err } from "@/lib/api-helpers";
import { getContributionsByCustomer } from "@/lib/firestore/contributions";
import { getCustomerByUid } from "@/lib/firestore/customers";

export async function GET(req: NextRequest, { params }: { params: { customerId: string } }) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "admin") {
      const customer = await getCustomerByUid(decoded.uid);
      if (!customer || customer.id !== params.customerId) {
        return err("FORBIDDEN", "Access denied", 403);
      }
    }

    const contributions = await getContributionsByCustomer(params.customerId);
    return ok({ contributions });
  });
}
