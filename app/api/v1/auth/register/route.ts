export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err, validationError, serverError, getIpFromRequest } from "@/lib/api-helpers";
import { registerCustomerSchema } from "@/schemas/customer.schema";
import { setCustomClaim, ADMIN_USERNAMES } from "@/lib/auth";
import { createCustomer, getCustomerByPhone } from "@/lib/firestore/customers";
import { createCredentials, isUsernameTaken } from "@/lib/firestore/credentials";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notify } from "@/lib/notifications";
import { FieldValue } from "firebase-admin/firestore";
import { auth } from "@/lib/firebase-admin";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function validateUsername(raw: string): { valid: boolean; reason?: string } {
  const u = raw.toLowerCase().trim();
  if (!u) return { valid: false, reason: "Username is required" };
  if (u.length < 3) return { valid: false, reason: "Username must be at least 3 characters" };
  if (u.length > 20) return { valid: false, reason: "Username must be 20 characters or less" };
  if (!USERNAME_RE.test(u)) return { valid: false, reason: "Username may only contain letters, numbers, and underscores" };
  return { valid: true };
}

export async function POST(req: NextRequest) {
  const ip = getIpFromRequest(req);
  const body = await req.json().catch(() => null);
  if (!body) return validationError("Request body required");

  const password = (body.password as string | undefined) ?? "";
  const rawUsername = ((body.username as string | undefined) ?? "").toLowerCase().trim();

  if (!password) return validationError("Password is required");

  const pwCheck = validatePasswordStrength(password);
  if (!pwCheck.valid) return validationError(pwCheck.reason!);

  // ── Reserved usernames ───────────────────────────────────────────────────
  // ADMIN_USERNAMES grant admin role at login (see login/route.ts) purely by
  // matching username, once the caller has proven they know that account's
  // password. This endpoint is public and unauthenticated, so it must never be
  // able to create or overwrite credentials for one of those names — there used
  // to be a fast-path here that did exactly that (create-or-overwrite with no
  // password check), which let anyone take over the admin account outright.
  // Blocking the name here, for every path, closes that door for good — including
  // the version of the exploit that goes through ordinary customer registration
  // with a reserved-but-never-actually-claimed name (e.g. "glitch2024") and then
  // logs in normally to collect admin on arrival.
  if (ADMIN_USERNAMES.has(rawUsername)) {
    return err("USERNAME_TAKEN", "That username is already taken. Please choose another.", 409);
  }

  // ── Validate username ────────────────────────────────────────────────────
  const unCheck = validateUsername(rawUsername);
  if (!unCheck.valid) return validationError(unCheck.reason!);
  const username = rawUsername;

  const taken = await isUsernameTaken(username);
  if (taken) return err("USERNAME_TAKEN", "That username is already taken. Please choose another.", 409);

  // ── Customer path ────────────────────────────────────────────────────────
  const parsed = registerCustomerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.message);

  const phone = parsed.data.phone;
  const existingCustomer = await getCustomerByPhone(phone);
  if (existingCustomer) return err("PHONE_EXISTS", "Phone number already registered", 409);

  let uid: string;
  try {
    const fbUser = await auth.createUser({ displayName: parsed.data.fullName });
    uid = fbUser.uid;
    await setCustomClaim(uid, "customer");
  } catch (e: unknown) {
    return serverError(e instanceof Error ? e.message : "Firebase error");
  }

  const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
  const customerId = await createCustomer({
    uid,
    fullName: parsed.data.fullName,
    phone,
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
  await createCredentials(uid, phone, hash, false, username);
  const customToken = await auth.createCustomToken(uid, { role: "customer" });

  await Promise.all([
    writeAuditLog({
      action: "customer.self_registered",
      performedBy: uid,
      performedByRole: "customer",
      targetId: customerId,
      targetCollection: "customers",
      before: null,
      after: { uid, phone, fullName: parsed.data.fullName, username },
      ipAddress: ip,
    }),
    notify({
      recipientUid: uid,
      recipientRole: "customer",
      title: "Welcome to Shaka Saves!",
      body: "Your savings account is ready. Start by making your first contribution.",
      type: "system",
    }),
  ]);

  return ok({ customerId, uid, customToken }, 201);
}
