import { db } from "@/lib/firebase-admin";
import type { Withdrawal, WithdrawalStatus } from "@/types";

const col = () => db.collection("withdrawals");

export async function createWithdrawal(data: Omit<Withdrawal, "id">): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function getWithdrawalById(id: string): Promise<Withdrawal | null> {
  const doc = await col().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Withdrawal;
}

export async function listWithdrawals(opts: {
  status?: WithdrawalStatus;
  limit?: number;
  cursor?: string;
} = {}): Promise<{ withdrawals: Withdrawal[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  let q = col().orderBy("requestedAt", "desc") as FirebaseFirestore.Query;

  if (opts.status) q = q.where("status", "==", opts.status);
  if (opts.cursor) {
    const cursorDoc = await col().doc(opts.cursor).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }

  const snap = await q.limit(limit + 1).get();
  const withdrawals = snap.docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() } as Withdrawal));
  const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;
  return { withdrawals, nextCursor };
}

export async function listCustomerWithdrawals(customerId: string): Promise<Withdrawal[]> {
  const snap = await col().where("customerId", "==", customerId).orderBy("requestedAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Withdrawal));
}

export async function updateWithdrawal(
  id: string,
  data: Partial<Omit<Withdrawal, "id">>
): Promise<void> {
  await col().doc(id).update(data);
}
