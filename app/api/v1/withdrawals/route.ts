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
import { computeWithdrawable } from "@/lib/utils/card-withdrawable";

export async function POST(req: NextRequest) {
  return withFinancialAuth(req, async (decoded) => {
    if (decoded.role !== "customer") return err("FORBIDDEN", "Customers only", 403);

    const body = await req.json().catch(() => null);
    const parsed = requestWithdrawalSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const customer = await getCustomerByUid(decoded.uid);
    if (!customer) return err("NOT_FOUND", "Customer not found", 404);

    // ── Build per-card eligibility map ───────────────────────────────
    const [cardsSnap, activePlans] = await Promise.all([
      db.collection("savings_cards").where("customerId", "==", customer.id).get(),
      listActivePlans(),
    ]);

    const planByName = new Map<string, SavingsPlan>(
      activePlans.map((p) => [p.name.toLowerCase(), p])
    );
    const nowMs = Date.now();

    // cardId → withdrawable amount (0 if locked)
    const withdrawableByCard = new Map<string, number>();

    for (const doc of cardsSnap.docs) {
      const card = doc.data() as SavingsCard;
      const firestorePlan = planByName.get((card.category ?? "").toLowerCase()) ?? null;
      const effective = resolveEffectivePlan(card.category, firestorePlan);

      const { withdrawable: netBalance } = computeWithdrawable(card);

      let locked = false;
      if (effective?.lockDays) {
        const createdMs = (card.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? nowMs;
        locked = (nowMs - createdMs) / 86_400_000 < effective.lockDays;
      } else if (effective?.targetAmount) {
        locked = card.currentBalance < effective.targetAmount;
      }

      withdrawableByCard.set(doc.id, locked ? 0 : netBalance);
    }

    // ── Validate each card selection against server-side eligibility ──
    const { cardSelections } = parsed.data;
    for (const sel of cardSelections) {
      const available = withdrawableByCard.get(sel.cardId);
      if (available === undefined) {
        return err("INVALID_CARD", `Card "${sel.cardName}" does not belong to your account`, 400);
      }
      if (available === 0) {
        return err("CARD_LOCKED", `Card "${sel.cardName}" is locked and cannot be withdrawn from`, 400);
      }
      if (sel.amountFromCard > available) {
        return err(
          "INSUFFICIENT_BALANCE",
          `Card "${sel.cardName}" only has ₦${available.toLocaleString("en-NG")} withdrawable`,
          400
        );
      }
    }

    // amountRequested is computed server-side — never trust the client value
    const amountRequested = cardSelections.reduce((s, c) => s + c.amountFromCard, 0);

    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const withdrawalId = await createWithdrawal({
      customerId: customer.id,
      amountRequested,
      cardSelections,
      requestedAt: now,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      paidAt: null,
      accountNumber: parsed.data.accountNumber,
      accountName: parsed.data.accountName,
      bankName: parsed.data.bankName,
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
        after: { withdrawalId, amount: amountRequested, cardSelections },
        ipAddress: getIpFromRequest(req),
      }),
      notifyWithdrawalRequested({
        adminUid,
        adminEmail: process.env.SENDGRID_FROM_EMAIL ?? "",
        customerName: customer.fullName,
        amount: amountRequested,
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
