export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { listAuditLogs } from "@/lib/firestore/audit";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
    const cursor = searchParams.get("cursor") ?? undefined;
    const targetCollection = searchParams.get("collection") ?? undefined;

    const { logs, nextCursor } = await listAuditLogs({ limit, cursor, targetCollection });
    return ok({ logs, nextCursor });
  });
}
