export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = searchParams.get("to") ?? new Date().toISOString();

    const activeCount = (
      await db.collection("customers").where("deletedAt", "==", null).where("status", "==", "active").count().get()
    ).data().count;

    const contribSnap = await db
      .collection("contributions")
      .where("confirmedAt", ">=", new Date(from))
      .where("confirmedAt", "<=", new Date(to))
      .where("deletedAt", "==", null)
      .get();

    // Group by date
    const byDate = new Map<string, Set<string>>();
    contribSnap.docs.forEach((d) => {
      const data = d.data();
      const date = data.confirmedAt?.toDate ? data.confirmedAt.toDate() : new Date();
      const key = date.toISOString().slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, new Set());
      byDate.get(key)!.add(data.customerId);
    });

    const data = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, customers]) => ({
        date,
        payers: customers.size,
        rate: activeCount > 0 ? Math.round((customers.size / activeCount) * 100) : 0,
      }));

    return ok({ data, activeCustomers: activeCount });
  });
}
