import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { MigrationImportRequest } from "@/types";

const col = () => db.collection("migration_import_requests");

export async function createMigrationRequest(
  data: Omit<MigrationImportRequest, "id">
): Promise<string> {
  const ref = await col().add(data);
  return ref.id;
}

export async function getMigrationRequestById(
  id: string
): Promise<MigrationImportRequest | null> {
  const doc = await col().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as MigrationImportRequest;
}

export async function getCustomerPendingMigration(
  customerId: string
): Promise<MigrationImportRequest | null> {
  const snap = await col()
    .where("customerId", "==", customerId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as MigrationImportRequest;
}

/** True if a code already has an approved import — blocks re-import. */
export async function isCodeAlreadyApproved(code: string): Promise<boolean> {
  const snap = await col()
    .where("migrationCode", "==", code)
    .where("status", "==", "approved")
    .limit(1)
    .get();
  return !snap.empty;
}

/** Returns the most recent request for this customer regardless of status. */
export async function getLatestCustomerMigration(
  customerId: string
): Promise<MigrationImportRequest | null> {
  const snap = await col()
    .where("customerId", "==", customerId)
    .get();
  if (snap.empty) return null;
  const items = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as MigrationImportRequest)
  );
  items.sort((a, b) => {
    const aS = (a.submittedAt as unknown as { seconds?: number })?.seconds ?? 0;
    const bS = (b.submittedAt as unknown as { seconds?: number })?.seconds ?? 0;
    return bS - aS;
  });
  return items[0];
}

export async function listMigrationRequests(
  status?: "pending" | "approved" | "rejected"
): Promise<MigrationImportRequest[]> {
  let q = col() as FirebaseFirestore.Query;
  if (status) q = q.where("status", "==", status);
  const snap = await q.get();
  const items = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as MigrationImportRequest)
  );
  return items.sort((a, b) => {
    const aS = (a.submittedAt as unknown as { seconds?: number })?.seconds ?? 0;
    const bS = (b.submittedAt as unknown as { seconds?: number })?.seconds ?? 0;
    return bS - aS;
  });
}

export async function reviewMigrationRequest(
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
