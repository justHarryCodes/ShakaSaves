import { db } from "@/lib/firebase-admin";
import type { Contribution, ContributionFrequency } from "@/types";

const col = () => db.collection("contributions");

export async function createContributions(
  contributions: Omit<Contribution, "id">[],
  transaction: FirebaseFirestore.Transaction
): Promise<void> {
  for (const c of contributions) {
    const ref = col().doc();
    transaction.set(ref, c);
  }
}

export async function getContributionsByCustomer(customerId: string): Promise<Contribution[]> {
  const snap = await col()
    .where("customerId", "==", customerId)
    .where("deletedAt", "==", null)
    .orderBy("confirmedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contribution));
}

export async function getContributionsByMonth(
  customerId: string,
  year: number,
  month: number,
  frequency: ContributionFrequency
): Promise<Contribution[]> {
  let prefix: string;
  if (frequency === "daily") {
    prefix = `${year}-${String(month).padStart(2, "0")}`;
  } else if (frequency === "weekly") {
    prefix = `${year}-W`;
  } else {
    prefix = `${year}-M`;
  }

  const snap = await col()
    .where("customerId", "==", customerId)
    .where("deletedAt", "==", null)
    .orderBy("period", "asc")
    .startAt(prefix)
    .endAt(prefix + "")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contribution));
}

export async function getConfirmedPeriodsForCustomer(
  customerId: string,
  frequency: ContributionFrequency,
  _year: number,
  _month?: number
): Promise<string[]> {
  const q = col()
    .where("customerId", "==", customerId)
    .where("frequency", "==", frequency)
    .where("deletedAt", "==", null) as FirebaseFirestore.Query;

  const snap = await q.get();
  return snap.docs.map((d) => (d.data() as Contribution).period).filter((p): p is string => !!p);
}

export async function getTotalConfirmedByMonth(
  customerId: string,
  year: number,
  month: number
): Promise<number> {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const snap = await col()
    .where("customerId", "==", customerId)
    .where("deletedAt", "==", null)
    .orderBy("period")
    .startAt(monthStr)
    .endAt(monthStr + "")
    .get();

  return snap.docs.reduce((sum, d) => sum + ((d.data() as Contribution).amount ?? 0), 0);
}
