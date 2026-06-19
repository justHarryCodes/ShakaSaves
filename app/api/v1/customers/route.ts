export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, validationError, serverError } from "@/lib/api-helpers";
import { createCustomerSchema } from "@/schemas/customer.schema";
import { createCustomer, listCustomers } from "@/lib/firestore/customers";
import { createFirebaseUser, setCustomClaim } from "@/lib/auth";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWelcome } from "@/lib/notifications";
import { getIpFromRequest } from "@/lib/redis";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
    const cursor = searchParams.get("cursor") ?? undefined;
    const status = searchParams.get("status") as "active" | "inactive" | undefined;

    const { customers, nextCursor } = await listCustomers({ limit, cursor, status });
    return ok({ customers, nextCursor });
  });
}

export async function POST(req: NextRequest) {
  return withRole(req, "admin", async (decoded) => {
    const body = await req.json().catch(() => null);
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const { password, ...data } = parsed.data;
    let uid: string;

    try {
      const fbUser = await createFirebaseUser(data.email, password, data.fullName);
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
        action: "customer.created",
        performedBy: decoded.uid,
        performedByRole: "admin",
        targetId: customerId,
        targetCollection: "customers",
        before: null,
        after: { uid, ...data },
        ipAddress: getIpFromRequest(req),
      }),
      notifyWelcome({ customerUid: uid, customerEmail: data.email, customerName: data.fullName }),
    ]);

    return ok({ customerId }, 201);
  });
}
