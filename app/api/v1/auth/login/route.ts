export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err, validationError, getIpFromRequest } from "@/lib/api-helpers";
import { getCredentialsByUsername, recordFailedAttempt, clearFailedAttempts } from "@/lib/firestore/credentials";
import { verifyPassword } from "@/lib/password";
import { setCustomClaim, ADMIN_USERNAME } from "@/lib/auth";
import { auth } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { writeAuditLog } from "@/lib/firestore/audit";
import type { UserRole } from "@/types";

export async function POST(req: NextRequest) {
  const ip = getIpFromRequest(req);

  const body = await req.json().catch(() => null);
  if (!body?.username || !body?.password) return validationError("Username and password are required");

  const username = (body.username as string).toLowerCase().trim();
  const password = body.password as string;

  const creds = await getCredentialsByUsername(username);
  if (!creds) {
    return err("ACCOUNT_NOT_FOUND", "No account found with that username. Contact support on WhatsApp.", 404);
  }

  let firebaseUser;
  try {
    firebaseUser = await auth.getUser(creds.uid);
  } catch {
    return err("ACCOUNT_ERROR", "Account error. Contact support.", 400);
  }
  if (firebaseUser.disabled) {
    return err("ACCOUNT_DISABLED", "Your account has been disabled. Contact support on WhatsApp.", 403);
  }

  if (creds.lockedUntil) {
    const lockTs = creds.lockedUntil as Timestamp;
    if (lockTs.toMillis() > Date.now()) {
      const mins = Math.ceil((lockTs.toMillis() - Date.now()) / 60000);
      return err("ACCOUNT_LOCKED", `Account locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`, 429);
    }
  }

  const valid = await verifyPassword(password, creds.passwordHash);
  if (!valid) {
    const { locked } = await recordFailedAttempt(creds.uid);
    await writeAuditLog({
      action: "auth.login_failed",
      performedBy: creds.uid,
      performedByRole: "customer",
      targetId: creds.uid,
      targetCollection: "user_credentials",
      before: null,
      after: { reason: "invalid_password", ip },
      ipAddress: ip,
    }).catch(() => {});
    if (locked) return err("ACCOUNT_LOCKED", "Too many failed attempts. Account locked for 15 minutes.", 429);
    return err("INVALID_CREDENTIALS", "Invalid username or password.", 401);
  }

  await clearFailedAttempts(creds.uid);

  // Grant or revoke admin based solely on username
  const isAdmin = username === ADMIN_USERNAME;
  const currentRole = (firebaseUser.customClaims?.role as string) ?? "customer";
  if (isAdmin && currentRole !== "admin") {
    await setCustomClaim(creds.uid, "admin");
  } else if (!isAdmin && currentRole === "admin") {
    await setCustomClaim(creds.uid, "customer");
  }
  const role: UserRole = isAdmin ? "admin" : "customer";

  const additionalClaims = creds.mustChangePassword ? { mustChangePassword: true } : {};
  const customToken = await auth.createCustomToken(creds.uid, additionalClaims);

  await writeAuditLog({
    action: "auth.login_success",
    performedBy: creds.uid,
    performedByRole: role,
    targetId: creds.uid,
    targetCollection: "user_credentials",
    before: null,
    after: { ip },
    ipAddress: ip,
  }).catch(() => {});

  return ok({ customToken, requiresPasswordChange: creds.mustChangePassword });
}
