export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok } from "@/lib/api-helpers";
import { listActivePlans } from "@/lib/firestore/savings-plans";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const plans = await listActivePlans();
    return ok({ plans });
  });
}
