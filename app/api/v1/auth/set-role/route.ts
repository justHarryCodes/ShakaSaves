export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok, validationError } from "@/lib/api-helpers";
import { setCustomClaim } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  uid: z.string().min(1),
  role: z.enum(["admin", "customer"]),
});

export async function POST(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.message);

    await setCustomClaim(parsed.data.uid, parsed.data.role);
    return ok({ message: "Role updated. User must re-authenticate." });
  });
}
