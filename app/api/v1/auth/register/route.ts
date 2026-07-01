export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err, validationError, serverError, getIpFromRequest } from "@/lib/api-helpers";
import { registerCustomerSchema } from "@/schemas/customer.schema";
import { setCustomClaim, ADMIN_EMAILS } from "@/lib/auth";
import { createCustomer, getCustomerByEmail } from "@/lib/firestore/customers";
import { createCredentials } from "@/lib/firestore/credentials";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWelcome } from "@/lib/notifications";
import { FieldValue } from "firebase-admin/firestore";
import { auth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const ip = getIpFromRequest(req);
  const body = await req.json().catch(() => null);
  if (!body) return validationError("Request body required");

  const email = ((body.email as string | undefined) ?? "").toLowerCase().trim();
  const password = (body.password as string | undefined) ?? "";

  if (!email) return validationError("Email is required");
  if (!password) return validationError("Password is required");

  const pwCheck = validatePasswordStrength(password);
  if (!pwCheck.valid) return validationError(pwCheck.reason!);

  // ── Admin fast-path ──────────────────────────────────────────────────────
  if (ADMIN_EMAILS.has(email)) {
    try {
      let uid: string;
      try {
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
      } catch {
        const created = await auth.createUser({ email, displayName: (body.fullName as string | undefined) ?? "Admin" });
        uid = created.uid;
      }
      await setCustomClaim(uid, "admin");
      const hash = await hashPassword(password);
      await createCredentials(uid, email, hash);
      const customToken = await auth.createCustomToken(uid, {});
      await writeAuditLog({
        action: "auth.admin_registered",
        performedBy: uid,
        performedByRole: "admin",
        targetId: uid,
        targetCollection: "user_credentials",
        before: null,
        after: { email },
        ipAddress: ip,
      });
      return ok({ uid, customToken }, 201);
    } catch (e: unknown) {
      return serverError(e instanceof Error ? e.message : "Admin registration failed");
    }
  }

  // ── Customer path ────────────────────────────────────────────────────────
  const parsed = registerCustomerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.message);

  const existingCustomer = await getCustomerByEmail(email);
  if (existingCustomer) return err("EMAIL_EXISTS", "Email already registered", 409);

  let uid: string;
  try {
    const fbUser = await auth.createUser({ email, displayName: parsed.data.fullName });
    uid = fbUser.uid;
    await setCustomClaim(uid, "customer");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Firebase error";
    if (msg.includes("email-already-exists")) return err("EMAIL_EXISTS", "Email already in use", 409);
    return serverError(msg);
  }

  const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
  const customerId = await createCustomer({
    uid,
    fullName: parsed.data.fullName,
    email,
    phone: parsed.data.phone,
    contributionAmount: parsed.data.contributionAmount,
    contributionFrequency: parsed.data.contributionFrequency,
    monthlyTarget: parsed.data.monthlyTarget,
    minimumWithdrawalDays: parsed.data.minimumWithdrawalDays,
    currentBalance: 0,
    pendingBalance: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  const hash = await hashPassword(password);
  await createCredentials(uid, email, hash);
  const customToken = await auth.createCustomToken(uid, {});

  await Promise.all([
    writeAuditLog({
      action: "customer.self_registered",
      performedBy: uid,
      performedByRole: "customer",
      targetId: customerId,
      targetCollection: "customers",
      before: null,
      after: { uid, email, fullName: parsed.data.fullName },
      ipAddress: ip,
    }),
    notifyWelcome({ customerUid: uid, customerEmail: email, customerName: parsed.data.fullName }),
  ]);

  return ok({ customerId, uid, customToken }, 201);
}
