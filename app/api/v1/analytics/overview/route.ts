export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, serverError } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [customersSnap, pendingSnap, monthContribSnap] = await Promise.all([
        db.collection("customers").where("deletedAt", "==", null).where("status", "==", "active").count().get(),
        db.collection("payment_submissions").where("status", "==", "pending").count().get(),
        db.collection("contributions").where("confirmedAt", ">=", monthStart).where("deletedAt", "==", null).get(),
      ]);

      const totalCustomerBalance = (await db.collection("customers").where("deletedAt", "==", null).get()).docs
        .reduce((sum, d) => sum + (d.data().currentBalance ?? 0), 0);

      const monthlyCollections = monthContribSnap.docs.reduce((sum, d) => sum + (d.data().amount ?? 0), 0);

      const activeCount = customersSnap.data().count;
      const pendingCount = pendingSnap.data().count;

      // Collection rate = customers who submitted this month / total active
      const monthSubmitters = new Set(
        monthContribSnap.docs.map((d) => d.data().customerId)
      ).size;
      const collectionRate = activeCount > 0 ? Math.round((monthSubmitters / activeCount) * 100) : 0;

      return ok({
        totalSavingsUnderManagement: totalCustomerBalance,
        activeCustomers: activeCount,
        pendingPayments: pendingCount,
        monthlyCollections,
        collectionRate,
      });
    } catch (e) {
      console.error("Analytics overview error", e);
      return serverError("Failed to load analytics");
    }
  });
}
