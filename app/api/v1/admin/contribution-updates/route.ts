export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { listUpdateRequests } from "@/lib/firestore/contribution-updates";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as "pending" | "approved" | "rejected" | null;
    const requests = await listUpdateRequests(status ?? undefined);
    return ok({ requests });
  });
}
