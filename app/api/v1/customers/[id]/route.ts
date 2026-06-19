export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, notFound, validationError } from "@/lib/api-helpers";
import { getCustomerById, updateCustomer, softDeleteCustomer } from "@/lib/firestore/customers";
import { updateCustomerSchema } from "@/schemas/customer.schema";
import { writeAuditLog } from "@/lib/firestore/audit";
import { getIpFromRequest } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(req, async (decoded) => {
    const customer = await getCustomerById(params.id);
    if (!customer || customer.deletedAt) return notFound("Customer not found");

    if (decoded.role !== "admin" && decoded.uid !== customer.uid) {
      return err("FORBIDDEN", "Access denied", 403);
    }

    return ok({ customer });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "admin") return err("FORBIDDEN", "Admin only", 403);

    const customer = await getCustomerById(params.id);
    if (!customer || customer.deletedAt) return notFound("Customer not found");

    const body = await req.json().catch(() => null);
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    await updateCustomer(params.id, parsed.data);

    await writeAuditLog({
      action: "customer.updated",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: params.id,
      targetCollection: "customers",
      before: customer as unknown as Record<string, unknown>,
      after: { ...customer, ...parsed.data },
      ipAddress: getIpFromRequest(req),
    });

    return ok({ message: "Customer updated" });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== "admin") return err("FORBIDDEN", "Admin only", 403);

    const customer = await getCustomerById(params.id);
    if (!customer || customer.deletedAt) return notFound("Customer not found");

    await softDeleteCustomer(params.id);

    await writeAuditLog({
      action: "customer.deleted",
      performedBy: decoded.uid,
      performedByRole: "admin",
      targetId: params.id,
      targetCollection: "customers",
      before: customer as unknown as Record<string, unknown>,
      after: { ...customer, deletedAt: new Date().toISOString() },
      ipAddress: getIpFromRequest(req),
    });

    return ok({ message: "Customer deactivated" });
  });
}
