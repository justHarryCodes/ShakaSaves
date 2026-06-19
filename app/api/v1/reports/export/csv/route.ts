export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import type { Contribution, Customer } from "@/types";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const contribSnap = await db
      .collection("contributions")
      .where("deletedAt", "==", null)
      .orderBy("confirmedAt", "desc")
      .get();

    const customerSnap = await db.collection("customers").where("deletedAt", "==", null).get();
    const customerMap = new Map(customerSnap.docs.map((d) => [d.id, (d.data() as Customer).fullName]));

    const rows = [
      ["Customer ID", "Customer Name", "Period", "Frequency", "Amount (NGN)", "Confirmed At"].join(","),
      ...contribSnap.docs.map((d) => {
        const c = d.data() as Contribution;
        const confirmedAt = c.confirmedAt?.toDate ? c.confirmedAt.toDate().toISOString().slice(0, 10) : "";
        return [
          c.customerId,
          `"${customerMap.get(c.customerId) ?? ""}"`,
          c.period,
          c.frequency,
          c.amount.toFixed(2),
          confirmedAt,
        ].join(",");
      }),
    ].join("\n");

    return new NextResponse(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="contributions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
