export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok } from "@/lib/api-helpers";
import { markNotificationRead } from "@/lib/firestore/notifications";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(req, async () => {
    await markNotificationRead(params.id);
    return ok({ message: "Marked as read" });
  });
}
