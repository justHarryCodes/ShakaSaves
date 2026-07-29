export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound, serverError, getIpFromRequest } from "@/lib/api-helpers";
import { getMigrationRequestById } from "@/lib/firestore/migration-imports";
import { getCustomerById } from "@/lib/firestore/customers";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { notify } from "@/lib/notifications";
import { generateMigrationDates } from "@/lib/utils/virtual-dates";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const request = await getMigrationRequestById(params.id);
    if (!request) return notFound("Migration request not found");
    if (request.status !== "pending") return err("ALREADY_REVIEWED", "Already reviewed", 409);

    const customer = await getCustomerById(request.customerId);
    if (!customer) return notFound("Customer not found");

    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const requestRef = db.collection("migration_import_requests").doc(params.id);
    const auditRef = db.collection("audit_logs").doc();

    // Pre-build card refs so we can batch-create inside the transaction
    const cardRefs = request.subAccounts.map(() => db.collection("savings_cards").doc());

    try {
      await db.runTransaction(async (t) => {
        // Approve the migration request
        t.update(requestRef, {
          status: "approved",
          reviewedBy: decoded.uid,
          reviewedAt: now,
          rejectionReason: null,
        });

        // Create one SavingsCard per sub-account
        const balanceTotal = request.subAccounts.reduce((s, a) => s + a.cardBal, 0);

        // All migrated cards start from Jan 1, 2026 using virtual 31-day months.
        const MIGRATION_ANCHOR = "2026-01-01";

        request.subAccounts.forEach((sub, i) => {
          // Total days = net savings days + commission days so the calendar shows
          // gold commission markers correctly. currentBalance = cardBal (already
          // commission-adjusted per records.ts — do NOT deduct commission again).
          const daysMarked = sub.dailyMarking > 0
            ? Math.round((sub.totalSavings + (sub.adminCommission ?? 0)) / sub.dailyMarking)
            : 0;

          const tickedPeriods = generateMigrationDates(MIGRATION_ANCHOR, daysMarked);

          t.set(cardRefs[i], {
            customerId: request.customerId,
            customerName: customer.fullName,
            cardName: sub.customerName,
            category: sub.category,
            dailyAmount: sub.dailyMarking,
            currentBalance: sub.cardBal,
            tickedPeriods,
            migrated: true,
            migrationCode: request.migrationCode,
            migrationTotalSavings: sub.totalSavings,
            migrationAmountWtd: sub.amountWtd,
            migrationAdminCommission: sub.adminCommission ?? 0,
            migrationDailyMarking: sub.dailyMarking,
            createdAt: now,
            updatedAt: now,
          });
        });

        // Bump customer balance by total migrated card balance
        t.update(db.collection("customers").doc(request.customerId), {
          currentBalance: FieldValue.increment(balanceTotal),
          updatedAt: now,
        });

        t.set(auditRef, {
          action: "card_migration.approved",
          performedBy: decoded.uid,
          performedByRole: "admin",
          targetId: params.id,
          targetCollection: "migration_import_requests",
          before: null,
          after: {
            migrationCode: request.migrationCode,
            customerId: request.customerId,
            cardsCreated: cardRefs.map((r) => r.id),
          },
          timestamp: now,
          ipAddress: getIpFromRequest(req),
        });
      });
    } catch (e) {
      console.error("Migration approval failed", e);
      return serverError("Failed to approve migration");
    }

    const naira = (n: number) =>
      new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
    const totalBal = request.subAccounts.reduce((s, a) => s + a.cardBal, 0);

    await notify({
      recipientUid: customer.uid,
      recipientRole: "customer",
      title: "Savings card migration approved",
      body: `Your migration (${request.migrationCode}) has been approved. ${request.subAccounts.length} card${request.subAccounts.length > 1 ? "s" : ""} totalling ${naira(totalBal)} have been added to your account.`,
      type: "migration_approved",
      metadata: { requestId: params.id, migrationCode: request.migrationCode },
    });

    return ok({ message: "Approved", cardsCreated: cardRefs.length });
  });
}
