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

/**
 * Marks one notification read, but only if it actually belongs to `uid` — without this
 * check any logged-in user could flip the read flag on any other user's notification
 * (or the admin's) just by guessing/enumerating its Firestore ID.
 * Returns false if the notification doesn't exist or belongs to someone else.
 */
export async function markNotificationRead(id: string, uid: string): Promise<boolean> {
  const ref = col().doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.recipientUid !== uid) return false;
  await ref.update({ read: true });
  return true;
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await col().where("recipientUid", "==", uid).where("read", "==", false).get();
  // Firestore batched writes are capped at 500 operations — chunk so a long-lived
  // account with more unread notifications than that doesn't make this throw outright.
  const CHUNK = 500;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = db.batch();
    snap.docs.slice(i, i + CHUNK).forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  }
}

export async function getUnreadCount(uid: string): Promise<number> {
  const snap = await col().where("recipientUid", "==", uid).where("read", "==", false).count().get();
  return snap.data().count;
}
