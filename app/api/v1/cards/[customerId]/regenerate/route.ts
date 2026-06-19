export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, notFound, serverError } from "@/lib/api-helpers";
import { getCustomerById } from "@/lib/firestore/customers";
import { getCardByCustomerId, upsertCard } from "@/lib/firestore/cards";
import { generateSavingsCardImage } from "@/lib/card-generator";
import { uploadImage } from "@/lib/cloudinary";

export async function POST(req: NextRequest, { params }: { params: { customerId: string } }) {
  return withRole(req, "admin", async () => {
    const customer = await getCustomerById(params.customerId);
    if (!customer) return notFound("Customer not found");

    const card = await getCardByCustomerId(params.customerId);

    try {
      const now = new Date();
      const cardData = {
        customerName: customer.fullName,
        contributionAmount: customer.contributionAmount,
        frequency: customer.contributionFrequency,
        monthlyTarget: customer.monthlyTarget,
        cycleYear: card?.cycleYear ?? now.getFullYear(),
        cycleMonth: card?.cycleMonth ?? now.getMonth() + 1,
        tickedPeriods: card?.tickedPeriods ?? [],
        currentBalance: customer.currentBalance,
      };

      const buffer = await generateSavingsCardImage(cardData, customer.id);
      const { url: cardImageUrl, publicId: cardPublicId } = await uploadImage(
        buffer,
        "savings-cards",
        `card-${customer.id}`
      );

      await upsertCard(customer.id, {
        customerName: customer.fullName,
        contributionAmount: customer.contributionAmount,
        frequency: customer.contributionFrequency,
        monthlyTarget: customer.monthlyTarget,
        cycleYear: card?.cycleYear ?? now.getFullYear(),
        cycleMonth: card?.cycleMonth ?? now.getMonth() + 1,
        totalSlots: customer.contributionFrequency === "daily" ? 31 : customer.contributionFrequency === "weekly" ? 5 : 12,
        tickedPeriods: card?.tickedPeriods ?? [],
        currentBalance: customer.currentBalance,
        cardImageUrl,
        cardPublicId,
      });

      return ok({ cardImageUrl });
    } catch (e) {
      console.error("Card regeneration error", e);
      return serverError("Failed to regenerate card");
    }
  });
}
