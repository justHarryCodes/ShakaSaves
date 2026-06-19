export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err, validationError, serverError } from "@/lib/api-helpers";
import { globalRateLimiter, getIpFromRequest } from "@/lib/redis";
import { registerCustomerSchema } from "@/schemas/customer.schema";
import { createFirebaseUser, setCustomClaim } from "@/lib/auth";
import { createCustomer, getCustomerByEmail, getCustomerByUid } from "@/lib/firestore/customers";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWelcome } from "@/lib/notifications";
import { FieldValue } from "firebase-admin/firestore";
import { auth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const ip = getIpFromRequest(req);
  const { success } = await globalRateLimiter.limit(ip);
  if (!success) return err("RATE_LIMITED", "Too many requests", 429);

  // Check if this is a Google-authed registration (token in Authorization header)
  const authHeader = req.headers.get("authorization");
  let googleUid: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const decoded = await auth.verifyIdToken(token);
      googleUid = decoded.uid;

      // If user already has a role they're already registered
      if (decoded.role) return err("ALREADY_REGISTERED", "Account already set up", 409);

      // If customer doc already exists for this uid
      const existing = await getCustomerByUid(googleUid);
      if (existing) return err("ALREADY_REGISTERED", "Account already set up", 409);
    } catch {
      return err("INVALID_TOKEN", "Invalid authentication token", 401);
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = registerCustomerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.message);

  // For email/password registration, password is required
  if (!googleUid && !parsed.data.password) {
    return validationError("Password is required");
  }

  const existing = await getCustomerByEmail(parsed.data.email);
  if (existing) return err("EMAIL_EXISTS", "Email already registered", 409);

  const { password, ...data } = parsed.data;
  let uid: string;

  try {
    if (googleUid) {
      // Google user — Firebase Auth user already exists
      uid = googleUid;
      await setCustomClaim(uid, "customer");
    } else {
      // Email/password — create Firebase Auth user
      const fbUser = await createFirebaseUser(data.email, password!, data.fullName);
      uid = fbUser.uid;
      await setCustomClaim(uid, "customer");
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Firebase error";
    if (msg.includes("email-already-exists")) return err("EMAIL_EXISTS", "Email already in use", 409);
    return serverError(msg);
  }

  const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
  const customerId = await createCustomer({
    uid,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    contributionAmount: data.contributionAmount,
    contributionFrequency: data.contributionFrequency,
    monthlyTarget: data.monthlyTarget,
    minimumWithdrawalDays: data.minimumWithdrawalDays,
    currentBalance: 0,
    pendingBalance: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  await Promise.all([
    writeAuditLog({
      action: "customer.self_registered",
      performedBy: uid,
      performedByRole: "customer",
      targetId: customerId,
      targetCollection: "customers",
      before: null,
      after: { uid, email: data.email, fullName: data.fullName },
      ipAddress: ip,
    }),
    notifyWelcome({ customerUid: uid, customerEmail: data.email, customerName: data.fullName }),
  ]);

  return ok({ customerId, uid }, 201);
}
