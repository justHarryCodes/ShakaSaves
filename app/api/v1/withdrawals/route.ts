export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withFinancialAuth, withRole, ok, err, validationError } from "@/lib/api-helpers";
import { requestWithdrawalSchema } from "@/schemas/withdrawal.schema";
import { createWithdrawal, listWithdrawals } from "@/lib/firestore/withdrawals";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWithdrawalRequested } from "@/lib/notifications";
import { getIpFromRequest } from "@/lib/redis";
import { FieldValue } from "firebase-admin/firestore";
import { auth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  return withFinancialAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const body = await req.json().catch(() => null);
    const parsed = requestWithdrawalSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer not found", 404);

    if (customer.currentBalance < parsed.data.amountRequested) {
      return err("INSUFFICIENT_BALANCE", "Requested amount exceeds current balance", 400);
    }

    const createdAt = new Date();
    const minDays = customer.minimumWithdrawalDays ?? 30;
    const accountCreatedAt = customer.createdAt?.toDate?.() ?? new Date();
    const daysSinceCreation = Math.floor((createdAt.getTime() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreation < minDays) {
      return err("WITHDRAWAL_TOO_EARLY", `Withdrawals available after ${minDays} days`, 400);
    }

    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const withdrawalId = await createWithdrawal({
      customerId: customer.id,
      amountRequested: parsed.data.amountRequested,
      requestedAt: now,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      paidAt: null,
      note: parsed.data.note ?? null,
    });

    let adminUid = "";
    try {
      const adminUsers = await auth.listUsers(1000);
      const admin = adminUsers.users.find((u) => u.customClaims?.role === "admin");
      adminUid = admin?.uid ?? "";
    } catch {}

    await Promise.all([
      writeAuditLog({
        action: "withdrawal.requested",
        performedBy: decoded.uid,
        performedByRole: "customer",
        targetId: withdrawalId,
        targetCollection: "withdrawals",
        before: null,
        after: { withdrawalId, amount: parsed.data.amountRequested },
        ipAddress: getIpFromRequest(req),
      }),
      notifyWithdrawalRequested({
        adminUid,
        adminEmail: process.env.SENDGRID_FROM_EMAIL ?? "",
        customerName: customer.fullName,
        amount: parsed.data.amountRequested,
        withdrawalId,
        customerId: customer.id,
      }),
    ]);

    return ok({ withdrawalId }, 201);
  });
}

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as "pending" | "approved" | "rejected" | "paid" | undefined;
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
    const cursor = searchParams.get("cursor") ?? undefined;

    const { withdrawals, nextCursor } = await listWithdrawals({ status, limit, cursor });
    return ok({ withdrawals, nextCursor });
  });
}
