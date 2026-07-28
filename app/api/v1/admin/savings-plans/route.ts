export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, validationError, getIpFromRequest } from "@/lib/api-helpers";
import { listAllPlans, createPlan } from "@/lib/firestore/savings-plans";
import { FieldValue } from "firebase-admin/firestore";
import { writeAuditLog } from "@/lib/firestore/audit";
import { z } from "zod";

const bankAccountSchema = z.object({
  bankName: z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(100),
});

const planSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(2).max(500),
  minAmount: z.number().positive(),
  lockDays: z.number().int().positive().optional(),
  targetAmount: z.number().positive().optional(),
  bankAccount: bankAccountSchema.optional(),
});

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const plans = await listAllPlans();
    return ok({ plans });
  });
}

export async function POST(req: NextRequest) {
  return withRole(req, "admin", async (decoded) => {
    const body = await req.json().catch(() => null);
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    const now = FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp;
    const id = await createPlan({
      ...parsed.data,
      createdBy: decoded.uid,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog({
      action: "savings_plan.created",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: id,
      targetCollection: "savings_plans",
      before: null,
      after: { ...parsed.data, isActive: true },
      ipAddress: getIpFromRequest(req),
    });

    return ok({ id }, 201);
  });
}
