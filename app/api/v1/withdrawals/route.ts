export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withFinancialAuth, withRole, ok, err, validationError } from "@/lib/api-helpers";
import { requestWithdrawalSchema } from "@/schemas/withdrawal.schema";
import { createWithdrawal, listWithdrawals } from "@/lib/firestore/withdrawals";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { listActivePlans } from "@/lib/firestore/savings-plans";
import { writeAuditLog } from "@/lib/firestore/audit";
import { notifyWithdrawalRequested } from "@/lib/notifications";
import { getIpFromRequest } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";
import { db, auth } from "@/lib/firebase-admin";
import type { SavingsCard, SavingsPlan } from "@/types";

export async function POST(req: NextRequest) {
  return withFinancialAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const body = await req.json().catch(() => null);
    const parsed = requestWithdrawalSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer not found", 404);

    // ── Per-card withdrawal eligibility ──────────────────────────────
    const [cardsSnap, activePlans] = await Promise.all([
      db.collection("savings_cards").where("customerId", "==", customer.id).get(),
      listActivePlans(),
    ]);

    const planByName = new Map<string, SavingsPlan>(
      activePlans.map((p) => [p.name.toLowerCase(), p])
    );
    const nowMs = Date.now();

    let withdrawableBalance = 0;
    const lockedReasons: string[] = [];
    const hasSavingsCards = !cardsSnap.empty;

    for (const doc of cardsSnap.docs) {
      const card = doc.data() as SavingsCard;
      const plan = planByName.get((card.category ?? "").toLowerCase());

      // No matching plan → no restriction (treat as Regular)
      if (!plan) { withdrawableBalance += card.currentBalance; continue; }

      if (plan.lockDays) {
        const cardCreatedMs = (card.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? nowMs;
        const daysHeld = (nowMs - cardCreatedMs) / 86_400_000;
        if (daysHeld < plan.lockDays) {
          const unlockDate = new Date(cardCreatedMs + plan.lockDays * 86_400_000);
          const fmt = unlockDate.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
          lockedReasons.push(`${plan.name} card locked until ${fmt}`);
          continue;
        }
      }

      if (plan.targetAmount && card.currentBalance < plan.targetAmount) {
        const nairaFmt = (n: number) => "₦" + n.toLocaleString("en-NG");
        lockedReasons.push(
          `${plan.name} card requires ${nairaFmt(plan.targetAmount)} saved (currently ${nairaFmt(card.currentBalance)})`
        );
        continue;
      }

      withdrawableBalance += card.currentBalance;
    }

    // Fall back to old account-age check when customer has no card-plan cards
    if (!hasSavingsCards) {
      const minDays = customer.minimumWithdrawalDays ?? 30;
      const accountCreatedAt = customer.createdAt?.toDate?.() ?? new Date();
      const daysSinceCreation = Math.floor((Date.now() - accountCreatedAt.getTime()) / 86_400_000);
      if (daysSinceCreation < minDays) {
        return err("WITHDRAWAL_TOO_EARLY", `Withdrawals available after ${minDays} days`, 400);
      }
      withdrawableBalance = customer.currentBalance;
    }

    if (parsed.data.amountRequested > withdrawableBalance) {
      const detail = lockedReasons.length
        ? ` Locked: ${lockedReasons.join("; ")}.`
        : "";
      return err(
        "INSUFFICIENT_BALANCE",
        `Withdrawable balance is ₦${withdrawableBalance.toLocaleString("en-NG")}.${detail}`,
        400
      );
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
