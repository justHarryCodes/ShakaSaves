export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, notFound } from "@/lib/api-helpers";
import { getCardById } from "@/lib/firestore/cards";
import { getCustomerById } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async () => {
    const card = await getCardById(params.id);
    if (!card) return notFound("Card not found");

    const [customer, plans] = await Promise.all([
      getCustomerById(card.customerId),
      listActivePlans(),
    ]);

    const plan = plans.find((p) => p.name.toLowerCase() === (card.category ?? "").toLowerCase()) ?? null;

    return ok({ card, customer, plan });
  });
}
