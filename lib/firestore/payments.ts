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

function tsSeconds(ts: unknown): number {
  if (!ts) return 0;
  // Firestore Timestamp (server-side)
  if (typeof (ts as { seconds?: number }).seconds === "number") return (ts as { seconds: number }).seconds;
  return 0;
}

export async function listPayments(opts: ListPaymentsOptions = {}): Promise<{ payments: PaymentSubmission[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  // No orderBy in Firestore — avoids composite index requirement; sort in memory instead.
  let q = col() as FirebaseFirestore.Query;

  if (opts.status) q = q.where("status", "==", opts.status);
  if (opts.customerId) q = q.where("customerId", "==", opts.customerId);

  const snap = await q.get();
  let all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentSubmission));

  all.sort((a, b) => tsSeconds(b.submittedAt) - tsSeconds(a.submittedAt));

  // Cursor: find position of the cursor doc and slice from there
  let startIdx = 0;
  if (opts.cursor) {
    const idx = all.findIndex((p) => p.id === opts.cursor);
    if (idx !== -1) startIdx = idx + 1;
  }

  const page = all.slice(startIdx, startIdx + limit + 1);
  const payments = page.slice(0, limit);
  const nextCursor = page.length > limit ? payments[payments.length - 1].id : null;
  return { payments, nextCursor };
}

export async function listCustomerPayments(customerId: string): Promise<PaymentSubmission[]> {
  // No orderBy — avoids composite index on (customerId, submittedAt); sort in memory.
  const snap = await col().where("customerId", "==", customerId).get();
  const payments = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentSubmission));
  return payments.sort((a, b) => tsSeconds(b.submittedAt) - tsSeconds(a.submittedAt));
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
