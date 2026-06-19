export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import type { Customer, Contribution } from "@/types";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const customersSnap = await db.collection("customers").where("deletedAt", "==", null).get();
    const contribSnap = await db.collection("contributions").where("deletedAt", "==", null).get();

    // Group customers by month
    const customersByMonth = new Map<string, number>();
    customersSnap.docs.forEach((d) => {
      const ts = (d.data() as Customer).createdAt;
      if (!ts) return;
      const date = ts.toDate ? ts.toDate() : new Date(ts as unknown as string);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      customersByMonth.set(key, (customersByMonth.get(key) ?? 0) + 1);
    });

    // Group savings by month
    const savingsByMonth = new Map<string, number>();
    contribSnap.docs.forEach((d) => {
      const c = d.data() as Contribution;
      const period = c.period ?? "";
      const key = period.slice(0, 7); // YYYY-MM
      savingsByMonth.set(key, (savingsByMonth.get(key) ?? 0) + c.amount);
    });

    const allKeys = Array.from(new Set([...Array.from(customersByMonth.keys()), ...Array.from(savingsByMonth.keys())])).sort();

    const data = allKeys.map((month) => ({
      month,
      newCustomers: customersByMonth.get(month) ?? 0,
      totalSavings: savingsByMonth.get(month) ?? 0,
    }));

    return ok({ data });
  });
}
