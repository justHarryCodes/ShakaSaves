export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound, serverError, getIpFromRequest } from "@/lib/api-helpers";
import { getMigrationRequestById, reviewMigrationRequest } from "@/lib/firestore/migration-imports";
import { getCustomerById } from "@/lib/firestore/customers";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { notify } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const body = await req.json().catch(() => ({}));
    const reason = (body.reason as string | undefined)?.trim();
    if (!reason) return err("VALIDATION_ERROR", "Rejection reason is required", 422);

    const request = await getMigrationRequestById(params.id);
    if (!request) return notFound("Migration request not found");
    if (request.status !== "pending") return err("ALREADY_REVIEWED", "Already reviewed", 409);

    const customer = await getCustomerById(request.customerId);

    try {
      const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
      const auditRef = db.collection("audit_logs").doc();

      await db.runTransaction(async (t) => {
        await reviewMigrationRequest(params.id, "rejected", decoded.uid, reason, t);
        t.set(auditRef, {
          action: "card_migration.rejected",
          performedBy: decoded.uid,
          performedByRole: "admin",
          targetId: params.id,
          targetCollection: "migration_import_requests",
          before: null,
          after: { migrationCode: request.migrationCode, reason },
          timestamp: now,
          ipAddress: getIpFromRequest(req),
        });
      });
    } catch (e) {
      console.error("Migration rejection failed", e);
      return serverError("Failed to reject migration");
    }

    if (customer) {
      await notify({
        recipientUid: customer.uid,
        recipientRole: "customer",
        title: "Savings card migration not approved",
        body: `Your migration request (${request.migrationCode}) was not approved. Reason: ${reason}. Contact support for help.`,
        type: "migration_rejected",
        metadata: { requestId: params.id, migrationCode: request.migrationCode },
      });
    }

    return ok({ message: "Rejected" });
  });
}
