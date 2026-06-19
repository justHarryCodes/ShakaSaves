export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, serverError } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import { uploadPdf } from "@/lib/cloudinary";
import type { Customer, Contribution, Withdrawal } from "@/types";
import type { MonthlyReportData } from "@/lib/pdf-report";

async function buildPdfBuffer(data: MonthlyReportData): Promise<Buffer> {
  const React = await import("react");
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { MonthlyReport } = await import("@/lib/pdf-report");
  const element = React.createElement(MonthlyReport, { data }) as unknown as Parameters<typeof renderToBuffer>[0];
  return Buffer.from(await renderToBuffer(element));
}

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
      const monthNames = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
      ];

      const [customersSnap, contribSnap, withdrawalsSnap] = await Promise.all([
        db.collection("customers").where("deletedAt", "==", null).get(),
        db.collection("contributions")
          .where("deletedAt", "==", null)
          .orderBy("period")
          .startAt(monthPrefix)
          .endAt(monthPrefix + "ï£¿")
          .get(),
        db.collection("withdrawals")
          .where("requestedAt", ">=", monthStart)
          .where("requestedAt", "<=", monthEnd)
          .get(),
      ]);

      const customers = customersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
      const contributions = contribSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Contribution));
      const withdrawals = withdrawalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Withdrawal));

      const byCustomer = new Map<string, number>();
      const periodsByCustomer = new Map<string, number>();
      contributions.forEach((c) => {
        byCustomer.set(c.customerId, (byCustomer.get(c.customerId) ?? 0) + c.amount);
        periodsByCustomer.set(c.customerId, (periodsByCustomer.get(c.customerId) ?? 0) + 1);
      });

      const paidWithdrawals = withdrawals.filter((w) => w.status === "paid");
      const totalCollections = Array.from(byCustomer.values()).reduce((s, v) => s + v, 0);
      const activeCustomers = customers.filter((c) => c.status === "active");
      const totalBalance = activeCustomers.reduce((s, c) => s + c.currentBalance, 0);

      const newCustomers = customers.filter((c) => {
        const d = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(0);
        return d >= monthStart && d <= monthEnd;
      });

      const payers = new Set(contributions.map((c) => c.customerId));
      const defaulters = activeCustomers.filter((c) => !payers.has(c.id));

      const customerBreakdown = activeCustomers.map((c) => {
        const saved = byCustomer.get(c.id) ?? 0;
        const achievement = c.monthlyTarget > 0 ? Math.round((saved / c.monthlyTarget) * 100) : 0;
        return {
          id: c.id, fullName: c.fullName, frequency: c.contributionFrequency,
          periodsPaid: periodsByCustomer.get(c.id) ?? 0,
          amountConfirmed: saved, balance: c.currentBalance,
          target: c.monthlyTarget, achievement,
        };
      });

      const avgAchievement = customerBreakdown.length > 0
        ? Math.round(customerBreakdown.reduce((s, c) => s + c.achievement, 0) / customerBreakdown.length)
        : 0;

      const data: MonthlyReportData = {
        monthLabel: `${monthNames[month - 1]} ${year}`,
        totalCollections,
        activeCustomers: activeCustomers.length,
        newCustomers: newCustomers.length,
        withdrawalsPaid: paidWithdrawals.reduce((s, w) => s + w.amountRequested, 0),
        totalBalance,
        avgAchievement,
        customerBreakdown,
        defaulters: defaulters.map((d) => ({
          id: d.id, fullName: d.fullName, frequency: d.contributionFrequency, balance: d.currentBalance,
        })),
        withdrawalLog: withdrawals.map((w) => ({
          id: w.id, customerId: w.customerId, amount: w.amountRequested,
          requestedAt: (w.requestedAt as unknown as { toDate: () => Date })?.toDate?.()?.toLocaleDateString() ?? "",
          status: w.status,
        })),
      };

      const pdfBuffer = await buildPdfBuffer(data);
      const { url: reportUrl } = await uploadPdf(pdfBuffer, "monthly-reports");

      return ok({ reportUrl, month: monthNames[month - 1], year });
    } catch (e) {
      console.error("Monthly report error", e);
      return serverError("Failed to generate report");
    }
  });
}
