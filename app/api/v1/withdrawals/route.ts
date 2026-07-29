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
import { resolveEffectivePlan } from "@/lib/utils/plan-rules";

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
      const firestorePlan = planByName.get((card.category ?? "").toLowerCase()) ?? null;
      const effective = resolveEffectivePlan(card.category, firestorePlan);

      // For migrated cards, currentBalance = cardBal from records.ts which is
      // already net of admin commission — use it directly.
      // For new cards, 31 virtual days are marked per month but only 30 belong
      // to the user; 1 day/month is admin commission not yet physically deducted.
      const dailyAmt = card.dailyAmount ?? 0;
      let netBalance: number;
      if (card.migrated) {
        netBalance = card.currentBalance;
      } else {
        const commissionDays = new Set(
          (card.tickedPeriods ?? []).map((p: string) => p.slice(0, 7))
        ).size;
        netBalance = Math.max(0, card.currentBalance - commissionDays * dailyAmt);
      }

      // Regular/unknown with no plan → unrestricted
      if (!effective) { withdrawableBalance += netBalance; continue; }

      if (effective.lockDays) {
        const cardCreatedMs = (card.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? nowMs;
        const daysHeld = (nowMs - cardCreatedMs) / 86_400_000;
        if (daysHeld < effective.lockDays) {
          const unlockDate = new Date(cardCreatedMs + effective.lockDays * 86_400_000);
          const fmt = unlockDate.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
          lockedReasons.push(`${effective.name} card locked until ${fmt}`);
          continue;
        }
      }

      if (effective.targetAmount && card.currentBalance < effective.targetAmount) {
        const nairaFmt = (n: number) => "₦" + n.toLocaleString("en-NG");
        lockedReasons.push(
          `${effective.name} card requires ${nairaFmt(effective.targetAmount)} saved (currently ${nairaFmt(card.currentBalance)})`
        );
        continue;
      }

      withdrawableBalance += netBalance;
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
