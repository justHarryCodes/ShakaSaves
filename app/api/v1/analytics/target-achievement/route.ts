export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import type { Customer, Contribution } from "@/types";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

    const customersSnap = await db
      .collection("customers")
      .where("deletedAt", "==", null)
      .where("status", "==", "active")
      .get();

    const contribSnap = await db
      .collection("contributions")
      .where("deletedAt", "==", null)
      .orderBy("period")
      .startAt(monthPrefix)
      .endAt(monthPrefix + "")
      .get();

    const byCustomer = new Map<string, number>();
    contribSnap.docs.forEach((d) => {
      const c = d.data() as Contribution;
      byCustomer.set(c.customerId, (byCustomer.get(c.customerId) ?? 0) + c.amount);
    });

    const achievements = customersSnap.docs.map((d) => {
      const data = d.data() as Customer;
      const saved = byCustomer.get(d.id) ?? 0;
      const pct = data.monthlyTarget > 0 ? Math.round((saved / data.monthlyTarget) * 100) : 0;
      return {
        customerId: d.id,
        fullName: data.fullName,
        monthlyTarget: data.monthlyTarget,
        savedThisMonth: saved,
        achievementPct: pct,
      };
    });

    return ok({ achievements, month, year });
  });
}
