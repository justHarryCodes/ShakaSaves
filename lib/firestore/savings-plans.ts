import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { SavingsPlan } from "@/types";

const col = () => db.collection("savings_plans");

export async function createPlan(data: Omit<SavingsPlan, "id">): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function getPlanById(id: string): Promise<SavingsPlan | null> {
  const doc = await col().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as SavingsPlan;
}

export async function listActivePlans(): Promise<SavingsPlan[]> {
  const snap = await col().where("isActive", "==", true).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavingsPlan));
}

export async function listAllPlans(): Promise<SavingsPlan[]> {
  const snap = await col().get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as SavingsPlan))
    .sort((a, b) => {
      const aS = (a.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
      const bS = (b.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
      return bS - aS;
    });
}

export async function updatePlan(
  id: string,
  data: Partial<Pick<SavingsPlan, "name" | "description" | "minAmount" | "lockDays" | "targetAmount" | "isActive">>
): Promise<void> {
  await col().doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function listPlansByNames(names: string[]): Promise<SavingsPlan[]> {
  if (!names.length) return [];
  const snap = await col().where("name", "in", names).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavingsPlan));
}
