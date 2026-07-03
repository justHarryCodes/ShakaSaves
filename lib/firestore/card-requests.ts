import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CardRequest } from "@/types";

const col = () => db.collection("card_requests");

export async function createCardRequest(data: Omit<CardRequest, "id">): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function getCardRequestById(id: string): Promise<CardRequest | null> {
  const doc = await col().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as CardRequest;
}

export async function getPendingRequestByCustomer(customerId: string): Promise<CardRequest | null> {
  const snap = await col()
    .where("customerId", "==", customerId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CardRequest;
}

export async function listCardRequestsByCustomer(customerId: string): Promise<CardRequest[]> {
  const snap = await col().where("customerId", "==", customerId).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CardRequest));
  return all.sort((a, b) => {
    const aTs = (a.createdAt as unknown as { seconds: number })?.seconds ?? 0;
    const bTs = (b.createdAt as unknown as { seconds: number })?.seconds ?? 0;
    return bTs - aTs;
  });
}

export async function listCardRequests(status?: string): Promise<CardRequest[]> {
  const snap = await (status
    ? col().where("status", "==", status)
    : col()
  ).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CardRequest));
  return all.sort((a, b) => {
    const aTs = (a.createdAt as unknown as { seconds: number })?.seconds ?? 0;
    const bTs = (b.createdAt as unknown as { seconds: number })?.seconds ?? 0;
    return bTs - aTs;
  });
}

export async function updateCardRequest(
  id: string,
  data: Partial<Omit<CardRequest, "id">>,
  transaction?: FirebaseFirestore.Transaction
): Promise<void> {
  const ref = col().doc(id);
  const payload = { ...data, updatedAt: FieldValue.serverTimestamp() };
  if (transaction) {
    transaction.update(ref, payload);
  } else {
    await ref.update(payload);
  }
}
