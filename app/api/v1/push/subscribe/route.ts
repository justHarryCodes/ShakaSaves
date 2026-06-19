export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, serverError } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    try {
      const body = await req.json();
      const { endpoint, keys } = body;
      if (!endpoint || !keys?.auth || !keys?.p256dh) {
        return err("INVALID_SUBSCRIPTION", "Invalid push subscription", 400);
      }

      await db.collection("push_subscriptions").doc(decoded.uid).set({
        uid: decoded.uid,
        endpoint,
        keys,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return ok({ subscribed: true });
    } catch (e) {
      console.error("Push subscribe error", e);
      return serverError("Failed to save subscription");
    }
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    await db.collection("push_subscriptions").doc(decoded.uid).delete();
    return ok({ unsubscribed: true });
  });
}
