export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, withRole, ok, validationError } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { updateSettingsSchema } from "@/schemas/settings.schema";
import { writeAuditLog } from "@/lib/firestore/audit";
import { getIpFromRequest } from "@/lib/api-helpers";
import type { BankAccount } from "@/types";

const settingsRef = () => db.collection("admin_settings").doc("main");

// Normalise old single-account format into the new accounts array
function normalise(data: Record<string, unknown>): { accounts: BankAccount[] } {
  if (Array.isArray(data.accounts) && data.accounts.length > 0) {
    return { accounts: data.accounts as BankAccount[] };
  }
  // Legacy single-account document
  if (data.bankName && data.accountNumber && data.accountName) {
    return {
      accounts: [
        {
          id: "legacy-001",
          bankName: data.bankName as string,
          accountNumber: data.accountNumber as string,
          accountName: data.accountName as string,
        },
      ],
    };
  }
  // No accounts yet — seed Moniepoint placeholder
  return {
    accounts: [
      {
        id: "mpt-001",
        bankName: "Moniepoint",
        accountNumber: "5012345678",
        accountName: "Shaka Saves",
      },
    ],
  };
}

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const doc = await settingsRef().get();
    if (!doc.exists) {
      return ok({ settings: normalise({}) });
    }
    return ok({ settings: normalise(doc.data() as Record<string, unknown>) });
  });
}

export async function PATCH(req: NextRequest) {
  return withRole(req, "admin", async (decoded) => {
    const body = await req.json().catch(() => null);
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const before = (await settingsRef().get()).data() ?? null;
    await settingsRef().set(
      { accounts: parsed.data.accounts, updatedAt: FieldValue.serverTimestamp() },
      { merge: false }
    );

    await writeAuditLog({
      action: "settings.updated",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: "main",
      targetCollection: "admin_settings",
      before: before as Record<string, unknown> | null,
      after: { accounts: parsed.data.accounts },
      ipAddress: getIpFromRequest(req),
    });

    return ok({ message: "Settings updated" });
  });
}
