import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { SavingsCard } from "@/types";

const col = () => db.collection("savings_cards");

// ── New multi-card API ────────────────────────────────────────────

export async function createCard(data: Omit<SavingsCard, "id">): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function getCardById(id: string): Promise<SavingsCard | null> {
  const doc = await col().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as SavingsCard;
}

export async function listCardsByCustomer(customerId: string): Promise<SavingsCard[]> {
  const snap = await col()
    .where("customerId", "==", customerId)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavingsCard));
}

// Marks periods on a specific card by ID and increments its balance.
// Must be called inside a Firestore transaction.
export async function applyCardAllocation(
  cardId: string,
  newPeriods: string[],
  amount: number,
  transaction: FirebaseFirestore.Transaction
): Promise<void> {
  const ref = col().doc(cardId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const existing = ((snap.data() as SavingsCard).tickedPeriods ?? []).slice().sort();
  const merged = Array.from(new Set([...existing, ...newPeriods])).sort();
  transaction.update(ref, {
    tickedPeriods: merged,
    currentBalance: FieldValue.increment(amount),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ── Legacy API (kept for backward compat) ────────────────────────

export async function getCardByCustomerId(customerId: string): Promise<SavingsCard | null> {
  const snap = await col().where("customerId", "==", customerId).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as SavingsCard;
}

export async function upsertCard(
  customerId: string,
  data: Partial<SavingsCard>,
  transaction?: FirebaseFirestore.Transaction
): Promise<void> {
  const snap = await col().where("customerId", "==", customerId).limit(1).get();
  const payload = { ...data, updatedAt: FieldValue.serverTimestamp() };
  if (snap.empty) {
    const ref = col().doc();
    if (transaction) transaction.set(ref, { customerId, ...payload });
    else await ref.set({ customerId, ...payload });
  } else {
    const ref = col().doc(snap.docs[0].id);
    if (transaction) transaction.update(ref, payload);
    else await ref.update(payload);
  }
}

export async function addTickedPeriods(
  customerId: string,
  newPeriods: string[],
  transaction: FirebaseFirestore.Transaction
): Promise<void> {
  const snap = await col().where("customerId", "==", customerId).limit(1).get();
  if (snap.empty) return;
  const ref = col().doc(snap.docs[0].id);
  const existing = ((snap.docs[0].data() as SavingsCard).tickedPeriods ?? []).slice().sort();
  const merged = Array.from(new Set([...existing, ...newPeriods])).sort();
  transaction.update(ref, { tickedPeriods: merged, updatedAt: FieldValue.serverTimestamp() });
}
