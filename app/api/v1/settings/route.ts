export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, withRole, ok, validationError } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { updateSettingsSchema } from "@/schemas/settings.schema";
import { writeAuditLog } from "@/lib/firestore/audit";
import { getIpFromRequest } from "@/lib/redis";

const settingsRef = () => db.collection("admin_settings").doc("main");

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const doc = await settingsRef().get();
    if (!doc.exists) return ok({ settings: null });
    return ok({ settings: doc.data() });
  });
}

export async function PATCH(req: NextRequest) {
  return withRole(req, "admin", async (decoded) => {
    const body = await req.json().catch(() => null);
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const before = (await settingsRef().get()).data() ?? null;
    await settingsRef().set({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    await writeAuditLog({
      action: "settings.updated",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: "main",
      targetCollection: "admin_settings",
      before: before as Record<string, unknown> | null,
      after: parsed.data,
      ipAddress: getIpFromRequest(req),
    });

    return ok({ message: "Settings updated" });
  });
}
