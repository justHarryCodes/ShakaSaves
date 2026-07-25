export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, notFound, serverError, getIpFromRequest } from "@/lib/api-helpers";
import { MIGRATION_CARDS } from "@/lib/migration/records";
import { getCustomerByUid } from "@/lib/firestore/customers";
import {
  isCodeAlreadyApproved,
  getCustomerPendingMigration,
  createMigrationRequest,
  getLatestCustomerMigration,
} from "@/lib/firestore/migration-imports";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return ok({ migration: null });
    const migration = await getLatestCustomerMigration(customer.id);
    return ok({ migration });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    const body = await req.json().catch(() => ({}));
    const code = (body.migrationCode as string | undefined)?.trim().toUpperCase();
    if (!code) return err("VALIDATION_ERROR", "migrationCode is required", 422);

    const card = MIGRATION_CARDS.find((c) => c.migrationCode === code);
    if (!card) return notFound("Migration code not found");

    const [alreadyApproved, customer] = await Promise.all([
      isCodeAlreadyApproved(code),
      getCustomerByUid(decoded.uid),
    ]);

    if (alreadyApproved) return err("ALREADY_IMPORTED", "This code has already been imported", 409);
    if (!customer) return err("NO_PROFILE", "Customer profile not found", 404);

    const pending = await getCustomerPendingMigration(customer.id);
    if (pending) return err("PENDING_EXISTS", "You already have a pending migration request", 409);

    try {
      const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
      const auditRef = db.collection("audit_logs").doc();

      const requestId = await createMigrationRequest({
        migrationCode: code,
        customerId: customer.id,
        customerName: customer.fullName,
        uid: decoded.uid,
        subAccounts: card.subAccounts,
        status: "pending",
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
      });

      await auditRef.set({
        action: "card_migration.submitted",
        performedBy: decoded.uid,
        performedByRole: "customer",
        targetId: requestId,
        targetCollection: "migration_import_requests",
        before: null,
        after: { migrationCode: code, customerId: customer.id },
        timestamp: now,
        ipAddress: getIpFromRequest(req),
      });

      return ok({ requestId }, 201);
    } catch (e) {
      console.error("Migration submit failed", e);
      return serverError("Failed to submit migration request");
    }
  });
}
