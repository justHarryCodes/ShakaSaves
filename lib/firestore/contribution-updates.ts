import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ContributionUpdateRequest } from "@/types";

const col = () => db.collection("contribution_update_requests");

export async function createUpdateRequest(
  data: Omit<ContributionUpdateRequest, "id">
): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function getUpdateRequestById(id: string): Promise<ContributionUpdateRequest | null> {
  const doc = await col().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ContributionUpdateRequest;
}

export async function getCustomerPendingRequest(
  customerId: string
): Promise<ContributionUpdateRequest | null> {
  const snap = await col()
    .where("customerId", "==", customerId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ContributionUpdateRequest;
}

export async function listUpdateRequests(
  status?: "pending" | "approved" | "rejected"
): Promise<ContributionUpdateRequest[]> {
  let q = col() as FirebaseFirestore.Query;
  if (status) q = q.where("status", "==", status);
  const snap = await q.get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContributionUpdateRequest));
  return items.sort((a, b) => {
    const aS = (a.requestedAt as unknown as { seconds?: number })?.seconds ?? 0;
    const bS = (b.requestedAt as unknown as { seconds?: number })?.seconds ?? 0;
    return bS - aS;
  });
}

export async function reviewUpdateRequest(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  rejectionReason?: string,
  transaction?: FirebaseFirestore.Transaction
): Promise<void> {
  const ref = col().doc(id);
  const update: Record<string, unknown> = {
    status,
    reviewedBy,
    reviewedAt: FieldValue.serverTimestamp(),
    rejectionReason: rejectionReason ?? null,
  };
  if (transaction) {
    transaction.update(ref, update);
  } else {
    await ref.update(update);
  }
}
