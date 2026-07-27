export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { MIGRATION_CARDS } from "@/lib/migration/records";
import { cardTotals } from "@/lib/migration/migrationData";
import { db } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const snap = await db.collection("migration_import_requests").get();

    const requestMap = new Map<string, {
      id: string;
      status: "pending" | "approved" | "rejected";
      customerId: string;
      customerName: string;
      submittedAt: number;
      reviewedAt: number | null;
      rejectionReason: string | null;
    }>();

    const priority = { approved: 3, pending: 2, rejected: 1 } as const;

    snap.docs.forEach((doc) => {
      const d = doc.data();
      const code = d.migrationCode as string;
      const existing = requestMap.get(code);
      const np = priority[d.status as keyof typeof priority] ?? 0;
      const ep = existing ? (priority[existing.status] ?? 0) : -1;
      if (!existing || np > ep) {
        requestMap.set(code, {
          id: doc.id,
          status: d.status,
          customerId: d.customerId,
          customerName: d.customerName,
          submittedAt: (d.submittedAt as { seconds?: number })?.seconds ?? 0,
          reviewedAt: (d.reviewedAt as { seconds?: number })?.seconds ?? null,
          rejectionReason: d.rejectionReason ?? null,
        });
      }
    });

    const records = MIGRATION_CARDS.map((card) => {
      const totals = cardTotals(card);
      const req = requestMap.get(card.migrationCode) ?? null;
      return {
        migrationCode: card.migrationCode,
        primaryName: card.primaryName,
        subAccountCount: card.subAccounts.length,
        categories: card.subAccounts.map((s) => s.category),
        totals,
        migrationStatus: req?.status ?? "not_submitted",
        requestId: req?.id ?? null,
        customerId: req?.customerId ?? null,
        customerName: req?.customerName ?? null,
        submittedAt: req?.submittedAt ? new Date(req.submittedAt * 1000).toISOString() : null,
        reviewedAt: req?.reviewedAt ? new Date(req.reviewedAt * 1000).toISOString() : null,
        rejectionReason: req?.rejectionReason ?? null,
      };
    });

    return ok({ records });
  });
}
