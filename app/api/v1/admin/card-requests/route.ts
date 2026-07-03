export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { listCardRequests } from "@/lib/firestore/card-requests";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const requests = await listCardRequests(status);
    return ok({ requests });
  });
}
