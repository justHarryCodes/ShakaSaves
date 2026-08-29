export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, notFound } from "@/lib/api-helpers";
import { markNotificationRead } from "@/lib/firestore/notifications";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(req, async (decoded) => {
    const updated = await markNotificationRead(params.id, decoded.uid);
    if (!updated) return notFound("Notification not found");
    return ok({ message: "Marked as read" });
  });
}
