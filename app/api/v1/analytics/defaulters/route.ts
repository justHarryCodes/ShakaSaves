export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import type { Customer } from "@/types";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") ?? 7);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const customersSnap = await db
      .collection("customers")
      .where("deletedAt", "==", null)
      .where("status", "==", "active")
      .get();

    const recentSnap = await db
      .collection("payment_submissions")
      .where("submittedAt", ">=", cutoff)
      .get();

    const recentSubmitters = new Set(recentSnap.docs.map((d) => d.data().customerId));

    const defaulters = customersSnap.docs
      .filter((d) => !recentSubmitters.has(d.id))
      .map((d) => {
        const data = d.data() as Customer;
        return {
          id: d.id,
          fullName: data.fullName,
          email: data.email,
          contributionFrequency: data.contributionFrequency,
          currentBalance: data.currentBalance,
        };
      });

    return ok({ defaulters, days });
  });
}
