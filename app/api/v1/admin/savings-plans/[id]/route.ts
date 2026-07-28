export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, err, notFound, validationError, getIpFromRequest } from "@/lib/api-helpers";
import { getPlanById } from "@/lib/firestore/savings-plans";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { writeAuditLog } from "@/lib/firestore/audit";
import { z } from "zod";

const bankAccountSchema = z.object({
  bankName: z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(100),
});

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().min(2).max(500).optional(),
  minAmount: z.number().positive().optional(),
  lockDays: z.number().int().positive().nullable().optional(),
  targetAmount: z.number().positive().nullable().optional(),
  bankAccount: bankAccountSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const plan = await getPlanById(params.id);
    if (!plan) return notFound("Plan not found");

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);
    if (!Object.keys(parsed.data).length) return err("NO_CHANGES", "Nothing to update", 400);

    // Build the Firestore update — null means "remove the field"
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      updates[k] = v === null ? FieldValue.delete() : v;
    }
    await db.collection("savings_plans").doc(params.id).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: "savings_plan.updated",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: params.id,
      targetCollection: "savings_plans",
      before: { name: plan.name, description: plan.description, minAmount: plan.minAmount, isActive: plan.isActive },
      after: parsed.data,
      ipAddress: getIpFromRequest(req),
    });

    return ok({ message: "Updated" });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withRole(req, "admin", async (decoded) => {
    const plan = await getPlanById(params.id);
    if (!plan) return notFound("Plan not found");
    if (!plan.isActive) return err("ALREADY_INACTIVE", "Plan is already inactive", 409);

    await db.collection("savings_plans").doc(params.id).update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: "savings_plan.deactivated",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: params.id,
      targetCollection: "savings_plans",
      before: { isActive: true },
      after: { isActive: false },
      ipAddress: getIpFromRequest(req),
    });

    return ok({ message: "Deactivated" });
  });
}
