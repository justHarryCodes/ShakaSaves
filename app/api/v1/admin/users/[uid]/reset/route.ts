export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err, withRole, getIpFromRequest } from "@/lib/api-helpers";
import { auth } from "@/lib/firebase-admin";
import { upsertTemporaryPassword } from "@/lib/firestore/credentials";
import { generateTemporaryPassword, hashPassword, validatePasswordStrength } from "@/lib/password";
import { writeAuditLog } from "@/lib/firestore/audit";

export async function POST(req: NextRequest, { params }: { params: { uid: string } }) {
  const ip = getIpFromRequest(req);
  return withRole(req, "admin", async (decoded) => {
    const { uid } = params;

    let firebaseUser;
    try {
      firebaseUser = await auth.getUser(uid);
    } catch {
      return err("USER_NOT_FOUND", "User not found", 404);
    }

    const body = await req.json().catch(() => ({}));
    const providedPassword = body?.temporaryPassword as string | undefined;

    let temporaryPassword: string;
    if (providedPassword) {
      const check = validatePasswordStrength(providedPassword);
      if (!check.valid) return err("WEAK_PASSWORD", check.reason!, 422);
      temporaryPassword = providedPassword;
    } else {
      temporaryPassword = generateTemporaryPassword();
    }

    const hash = await hashPassword(temporaryPassword);
    await upsertTemporaryPassword(uid, firebaseUser.email ?? "", hash);

    await writeAuditLog({
      action: "admin.password_reset",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: uid,
      targetCollection: "user_credentials",
      before: null,
      after: { targetEmail: firebaseUser.email, adminEmail: decoded.email, ip },
      ipAddress: ip,
    });

    return ok({ temporaryPassword, message: "Temporary password set. Share it with the user via WhatsApp." });
  });
}
