import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { SavingsCard } from "@/types";

const col = () => db.collection("savings_cards");

export async function getCardByCustomerId(customerId: string): Promise<SavingsCard | null> {
  const snap = await col().where("customerId", "==", customerId).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as SavingsCard;
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
    if (transaction) {
      transaction.set(ref, { customerId, ...payload });
    } else {
      await ref.set({ customerId, ...payload });
    }
  } else {
    const ref = col().doc(snap.docs[0].id);
    if (transaction) {
      transaction.update(ref, payload);
    } else {
      await ref.update(payload);
    }
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
  const existing = (snap.docs[0].data() as SavingsCard).tickedPeriods ?? [];
  const merged = Array.from(new Set([...existing, ...newPeriods]));
  transaction.update(ref, { tickedPeriods: merged, updatedAt: FieldValue.serverTimestamp() });
}
