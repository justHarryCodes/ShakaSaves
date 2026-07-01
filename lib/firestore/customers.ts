import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Customer } from "@/types";

const col = () => db.collection("customers");

export async function getCustomerById(id: string): Promise<Customer | null> {
  const doc = await col().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Customer;
}

export async function getCustomerByUid(uid: string): Promise<Customer | null> {
  const snap = await col().where("uid", "==", uid).where("deletedAt", "==", null).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Customer;
}

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const snap = await col().where("email", "==", email).where("deletedAt", "==", null).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Customer;
}

export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  const snap = await col().where("phone", "==", phone).where("deletedAt", "==", null).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Customer;
}

export interface ListCustomersOptions {
  limit?: number;
  cursor?: string;
  search?: string;
  status?: "active" | "inactive";
}

export async function listCustomers(opts: ListCustomersOptions = {}): Promise<{ customers: Customer[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  let q = col().where("deletedAt", "==", null).orderBy("createdAt", "desc");

  if (opts.status) q = q.where("status", "==", opts.status) as typeof q;
  if (opts.cursor) {
    const cursorDoc = await col().doc(opts.cursor).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc) as typeof q;
  }

  const snap = await q.limit(limit + 1).get();
  const customers: Customer[] = snap.docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() } as Customer));
  const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;
  return { customers, nextCursor };
}

export async function createCustomer(data: Omit<Customer, "id">): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
  await col().doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function softDeleteCustomer(id: string): Promise<void> {
  await col().doc(id).update({
    deletedAt: FieldValue.serverTimestamp(),
    status: "inactive",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function incrementCustomerBalance(
  id: string,
  amount: number,
  type: "current" | "pending",
  transaction?: FirebaseFirestore.Transaction
): Promise<void> {
  const ref = col().doc(id);
  const field = type === "current" ? "currentBalance" : "pendingBalance";
  if (transaction) {
    transaction.update(ref, { [field]: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() });
  } else {
    await ref.update({ [field]: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() });
  }
}
