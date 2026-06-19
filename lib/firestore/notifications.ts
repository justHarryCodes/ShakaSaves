import { db } from "@/lib/firebase-admin";
import type { Notification } from "@/types";

const col = () => db.collection("notifications");

export async function createNotification(data: Omit<Notification, "id">): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function listNotifications(
  uid: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<{ notifications: Notification[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  let q = col()
    .where("recipientUid", "==", uid)
    .orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  if (opts.cursor) {
    const cursorDoc = await col().doc(opts.cursor).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }

  const snap = await q.limit(limit + 1).get();
  const notifications = snap.docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() } as Notification));
  const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;
  return { notifications, nextCursor };
}

export async function markNotificationRead(id: string): Promise<void> {
  await col().doc(id).update({ read: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await col().where("recipientUid", "==", uid).where("read", "==", false).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function getUnreadCount(uid: string): Promise<number> {
  const snap = await col().where("recipientUid", "==", uid).where("read", "==", false).count().get();
  return snap.data().count;
}
