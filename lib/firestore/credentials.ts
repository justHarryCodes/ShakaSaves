import { db } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const COLL = "user_credentials";
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface UserCredentials {
  uid: string;
  email: string;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: Timestamp | null;
  mustChangePassword: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function getCredentialsByEmail(email: string): Promise<(UserCredentials & { id: string }) | null> {
  const snap = await db.collection(COLL).where("email", "==", email.toLowerCase()).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as UserCredentials) };
}

export async function getCredentialsByUid(uid: string): Promise<(UserCredentials & { id: string }) | null> {
  const doc = await db.collection(COLL).doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as UserCredentials) };
}

export async function createCredentials(
  uid: string,
  email: string,
  passwordHash: string,
  mustChangePassword = false
): Promise<void> {
  await db.collection(COLL).doc(uid).set({
    uid,
    email: email.toLowerCase(),
    passwordHash,
    failedAttempts: 0,
    lockedUntil: null,
    mustChangePassword,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updatePassword(uid: string, passwordHash: string): Promise<void> {
  await db.collection(COLL).doc(uid).update({
    passwordHash,
    mustChangePassword: false,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function upsertTemporaryPassword(uid: string, email: string, passwordHash: string): Promise<void> {
  const docRef = db.collection(COLL).doc(uid);
  const doc = await docRef.get();
  if (doc.exists) {
    await docRef.update({
      passwordHash,
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await docRef.set({
      uid,
      email: email.toLowerCase(),
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
      mustChangePassword: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function recordFailedAttempt(uid: string): Promise<{ locked: boolean }> {
  const docRef = db.collection(COLL).doc(uid);
  const doc = await docRef.get();
  const current = (doc.data()?.failedAttempts ?? 0) as number;
  const newCount = current + 1;
  const locked = newCount >= MAX_FAILED;
  await docRef.update({
    failedAttempts: newCount,
    lockedUntil: locked ? Timestamp.fromMillis(Date.now() + LOCKOUT_MS) : null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { locked };
}

export async function clearFailedAttempts(uid: string): Promise<void> {
  await db.collection(COLL).doc(uid).update({
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
