export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { withRole } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import type { Customer, PaymentSubmission, Withdrawal, SavingsCard } from "@/types";

function ts(val: unknown): string {
  if (!val) return "";
  if (typeof val === "object" && "toDate" in (val as object)) {
    return (val as { toDate(): Date }).toDate().toISOString().replace("T", " ").slice(0, 19);
  }
  return String(val);
}

function naira(n: unknown): number {
  return typeof n === "number" ? n : 0;
}

async function fetchAll<T>(collection: string, orderField: string): Promise<T[]> {
  const snap = await db.collection(collection).orderBy(orderField, "desc").limit(5000).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const [customers, payments, withdrawals, cards] = await Promise.all([
      fetchAll<Customer>("customers", "createdAt"),
      fetchAll<PaymentSubmission>("payment_submissions", "submittedAt"),
      fetchAll<Withdrawal>("withdrawals", "requestedAt"),
      fetchAll<SavingsCard>("savings_cards", "updatedAt"),
    ]);

    // Build customer lookup for joining names onto withdrawals
    const customerById = new Map(customers.map((c) => [c.id, c]));

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Customers ──────────────────────────────────────────
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        customers
          .filter((c) => !c.deletedAt)
          .map((c) => ({
            "Customer ID": c.id,
            "Full Name": c.fullName,
            Email: c.email,
            Phone: c.phone,
            "Contribution Amount (₦)": naira(c.contributionAmount),
            Frequency: c.contributionFrequency,
            "Monthly Target (₦)": naira(c.monthlyTarget),
            "Current Balance (₦)": naira(c.currentBalance),
            "Pending Balance (₦)": naira(c.pendingBalance),
            Status: c.status,
            "Registered At": ts(c.createdAt),
          }))
      ),
      "Customers"
    );

    // ── Sheet 2: Deposits (Payments) ────────────────────────────────
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        payments.map((p) => {
          const isNew = !!(p.cardAllocations?.length);
          const amount = p.totalAmount ?? p.amount ?? 0;
          return {
            "Payment ID": p.id,
            "Customer Name": p.customerName,
            "Customer ID": p.customerId,
            "Total Amount (₦)": naira(amount),
            // New format: card breakdowns
            "Cards": isNew
              ? p.cardAllocations!.map((a) => `${a.cardName}: ₦${a.amount} (${a.daysOverride ?? a.daysToMark}d)`).join(" | ")
              : "",
            // Legacy format
            "Periods Count": !isNew ? (p.periodsCount ?? "") : "",
            Periods: !isNew ? (p.periods ?? []).join(", ") : "",
            Frequency: !isNew ? (p.frequency ?? "") : "daily",
            Status: p.status,
            "Submitted At": ts(p.submittedAt),
            "Reviewed At": ts(p.reviewedAt),
            "Reviewed By": p.reviewedBy ?? "",
            "Rejection Reason": p.rejectionReason ?? "",
            Note: p.note ?? "",
          };
        })
      ),
      "Deposits"
    );

    // ── Sheet 3: Withdrawals ────────────────────────────────────────
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        withdrawals.map((w) => {
          const cust = customerById.get(w.customerId);
          return {
            "Withdrawal ID": w.id,
            "Customer Name": cust?.fullName ?? "",
            "Customer Email": cust?.email ?? "",
            "Customer ID": w.customerId,
            "Amount Requested (₦)": naira(w.amountRequested),
            Status: w.status,
            "Requested At": ts(w.requestedAt),
            "Reviewed At": ts(w.reviewedAt),
            "Reviewed By": w.reviewedBy ?? "",
            "Rejection Reason": w.rejectionReason ?? "",
            "Paid At": ts(w.paidAt),
            Note: w.note ?? "",
          };
        })
      ),
      "Withdrawals"
    );

    // ── Sheet 4: Cards ──────────────────────────────────────────────
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        cards.map((card) => {
          const cust = customerById.get(card.customerId);
          const dailyAmt = card.dailyAmount ?? card.contributionAmount ?? 0;
          return {
            "Card ID": card.id,
            "Card Name": card.cardName ?? "Savings Card",
            "Owner Name": cust?.fullName ?? card.customerName ?? "",
            "Owner Email": cust?.email ?? "",
            "Customer ID": card.customerId,
            "Daily Amount (₦)": naira(dailyAmt),
            "Card Balance (₦)": naira(card.currentBalance),
            "Days Marked": (card.tickedPeriods ?? []).length,
            "Marked Dates": (card.tickedPeriods ?? []).join(", "),
            // Legacy fields
            Frequency: card.frequency ?? "daily",
            "Monthly Target (₦)": naira(card.monthlyTarget ?? 0),
            "Cycle Year": card.cycleYear ?? "",
            "Cycle Month": card.cycleMonth ?? "",
            "Last Updated": ts(card.updatedAt),
          };
        })
      ),
      "Cards"
    );

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shaka-saves-export-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
