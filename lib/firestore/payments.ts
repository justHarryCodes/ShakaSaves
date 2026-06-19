import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PaymentSubmission } from "@/types";

const col = () => db.collection("payment_submissions");

export async function createPaymentSubmission(data: Omit<PaymentSubmission, "id">): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function getPaymentById(id: string): Promise<PaymentSubmission | null> {
  const doc = await col().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as PaymentSubmission;
}

export interface ListPaymentsOptions {
  status?: "pending" | "confirmed" | "rejected";
  customerId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export async function listPayments(opts: ListPaymentsOptions = {}): Promise<{ payments: PaymentSubmission[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  let q = col().orderBy("submittedAt", "desc") as FirebaseFirestore.Query;

  if (opts.status) q = q.where("status", "==", opts.status);
  if (opts.customerId) q = q.where("customerId", "==", opts.customerId);

  if (opts.cursor) {
    const cursorDoc = await col().doc(opts.cursor).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }

  const snap = await q.limit(limit + 1).get();
  const payments = snap.docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() } as PaymentSubmission));
  const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;
  return { payments, nextCursor };
}

export async function listCustomerPayments(customerId: string): Promise<PaymentSubmission[]> {
  const snap = await col().where("customerId", "==", customerId).orderBy("submittedAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentSubmission));
}

export async function updatePaymentStatus(
  id: string,
  status: "confirmed" | "rejected",
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

export async function getPaymentByIdempotencyKey(key: string): Promise<PaymentSubmission | null> {
  const snap = await col().where("idempotencyKey", "==", key).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as PaymentSubmission;
}
