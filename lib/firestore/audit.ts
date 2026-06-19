import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { AuditLog, UserRole } from "@/types";

const col = () => db.collection("audit_logs");

export interface WriteAuditLogParams {
  action: string;
  performedBy: string;
  performedByRole: UserRole;
  targetId: string;
  targetCollection: string;
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  ipAddress: string;
  transaction?: FirebaseFirestore.Transaction;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  const payload: Omit<AuditLog, "id"> = {
    action: params.action,
    performedBy: params.performedBy,
    performedByRole: params.performedByRole,
    targetId: params.targetId,
    targetCollection: params.targetCollection,
    before: params.before ?? null,
    after: params.after,
    timestamp: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    ipAddress: params.ipAddress,
  };

  if (params.transaction) {
    const ref = col().doc();
    params.transaction.set(ref, payload);
  } else {
    await col().add(payload);
  }
}

export async function listAuditLogs(opts: {
  targetCollection?: string;
  performedBy?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<{ logs: AuditLog[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 50;
  let q = col().orderBy("timestamp", "desc") as FirebaseFirestore.Query;

  if (opts.targetCollection) q = q.where("targetCollection", "==", opts.targetCollection);
  if (opts.performedBy) q = q.where("performedBy", "==", opts.performedBy);
  if (opts.cursor) {
    const cursorDoc = await col().doc(opts.cursor).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }

  const snap = await q.limit(limit + 1).get();
  const logs = snap.docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() } as AuditLog));
  const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;
  return { logs, nextCursor };
}
