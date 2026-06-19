export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok } from "@/lib/api-helpers";
import { listNotifications } from "@/lib/firestore/notifications";

export async function GET(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
    const cursor = searchParams.get("cursor") ?? undefined;

    const { notifications, nextCursor } = await listNotifications(decoded.uid, { limit, cursor });
    return ok({ notifications, nextCursor });
  });
}
