export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err, validationError, withAuth, getIpFromRequest } from "@/lib/api-helpers";
import { getCredentialsByUid, updatePassword } from "@/lib/firestore/credentials";
import { validatePasswordStrength, hashPassword, verifyPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/firestore/audit";

export async function POST(req: NextRequest) {
  const ip = getIpFromRequest(req);
  return withAuth(req, async (decoded) => {
    const body = await req.json().catch(() => null);
    if (!body?.newPassword) return validationError("New password is required");

    const { newPassword, currentPassword } = body as { newPassword: string; currentPassword?: string };

    const check = validatePasswordStrength(newPassword);
    if (!check.valid) return validationError(check.reason!);

    const creds = await getCredentialsByUid(decoded.uid);
    if (!creds) return err("NO_CREDENTIALS", "Account not set up for custom auth", 404);

    // If not in forced-change mode, require current password verification
    if (!creds.mustChangePassword) {
      if (!currentPassword) return validationError("Current password is required");
      const valid = await verifyPassword(currentPassword, creds.passwordHash);
      if (!valid) return err("INVALID_CREDENTIALS", "Current password is incorrect", 401);
    }

    const hash = await hashPassword(newPassword);
    await updatePassword(decoded.uid, hash);

    await writeAuditLog({
      action: "auth.password_changed",
      performedBy: decoded.uid,
      performedByRole: decoded.role ?? "customer",
      targetId: decoded.uid,
      targetCollection: "user_credentials",
      before: null,
      after: { forced: creds.mustChangePassword, ip },
      ipAddress: ip,
    }).catch(() => {});

    return ok({ message: "Password changed successfully" });
  });
}
