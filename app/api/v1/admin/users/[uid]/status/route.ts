export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err, validationError, withRole, getIpFromRequest } from "@/lib/api-helpers";
import { auth } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/firestore/audit";

export async function PATCH(req: NextRequest, { params }: { params: { uid: string } }) {
  const ip = getIpFromRequest(req);
  return withRole(req, "admin", async (decoded) => {
    const { uid } = params;
    const body = await req.json().catch(() => null);
    if (typeof body?.disabled !== "boolean") return validationError("'disabled' (boolean) is required");

    let firebaseUser;
    try {
      firebaseUser = await auth.getUser(uid);
    } catch {
      return err("USER_NOT_FOUND", "User not found", 404);
    }

    await auth.updateUser(uid, { disabled: body.disabled });

    await writeAuditLog({
      action: body.disabled ? "admin.user_disabled" : "admin.user_enabled",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: uid,
      targetCollection: "users",
      before: { disabled: firebaseUser.disabled },
      after: { disabled: body.disabled, targetEmail: firebaseUser.email, ip },
      ipAddress: ip,
    });

    return ok({ uid, disabled: body.disabled });
  });
}
