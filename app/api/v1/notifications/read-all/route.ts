export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok } from "@/lib/api-helpers";
import { markAllNotificationsRead } from "@/lib/firestore/notifications";

export async function PATCH(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    await markAllNotificationsRead(decoded.uid);
    return ok({ message: "All notifications marked as read" });
  });
}
