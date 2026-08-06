export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err, withRole, getIpFromRequest } from "@/lib/api-helpers";
import { auth, db } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/firestore/audit";

export async function DELETE(req: NextRequest, { params }: { params: { uid: string } }) {
  const ip = getIpFromRequest(req);
  return withRole(req, "admin", async (decoded) => {
    const { uid } = params;

    // Prevent admins from deleting themselves
    if (decoded.uid === uid) {
      return err("FORBIDDEN", "You cannot delete your own account", 403);
    }

    // Verify user exists and is disabled — only disabled accounts may be deleted
    let firebaseUser;
    try {
      firebaseUser = await auth.getUser(uid);
    } catch {
      return err("USER_NOT_FOUND", "User not found", 404);
    }

    if (!firebaseUser.disabled) {
      return err("ACCOUNT_NOT_DISABLED", "Account must be disabled before it can be deleted", 400);
    }

    // Find the customer document by uid (simple equality — no composite index needed)
    const customerSnap = await db.collection("customers").where("uid", "==", uid).get();
    const customerId = customerSnap.empty ? null : customerSnap.docs[0].id;

    // Delete Firebase Auth user first
    await auth.deleteUser(uid);

    // Clean up Firestore — all queries are single-field equality checks (auto-indexed)
    const batch = db.batch();

    if (!customerSnap.empty) {
      batch.delete(customerSnap.docs[0].ref);

      if (customerId) {
        // Delete savings cards
        const cardsSnap = await db
          .collection("savings_cards")
          .where("customerId", "==", customerId)
          .get();
        for (const doc of cardsSnap.docs) batch.delete(doc.ref);

        // Delete withdrawal requests
        const withdrawalsSnap = await db
          .collection("withdrawals")
          .where("customerId", "==", customerId)
          .get();
        for (const doc of withdrawalsSnap.docs) batch.delete(doc.ref);

        // Delete notifications
        const notifSnap = await db
          .collection("notifications")
          .where("recipientUid", "==", uid)
          .get();
        for (const doc of notifSnap.docs) batch.delete(doc.ref);
      }
    }

    await batch.commit();

    try {
      await writeAuditLog({
        action: "admin.user_deleted",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: uid,
        targetCollection: "users",
        before: { email: firebaseUser.email ?? null, disabled: true, customerId },
        after: { deleted: true },
        ipAddress: ip,
      });
    } catch (e) {
      console.error("writeAuditLog failed (non-fatal):", e);
    }

    return ok({ uid, deleted: true });
  });
}
