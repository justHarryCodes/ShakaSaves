"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  onIdTokenChanged,
  type Auth,
  type User,
} from "firebase/auth";

// Firebase client SDK is used ONLY for authentication (getting ID tokens).
// All Firestore reads/writes go through /api/v1/* server routes.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getClientApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return _app;
}

export function getClientAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getClientApp());
  }
  return _auth;
}

// Lazy proxy so callers can import `clientAuth` and use it directly
export const clientAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (getClientAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getClientAuth(), email, password);
  // Force-refresh immediately so the session cookie contains the latest custom claims
  // (e.g. role="customer" set by the server during registration)
  const freshToken = await cred.user.getIdToken(true);
  await fetch("/api/v1/session", {
    method: "POST",
    body: JSON.stringify({ token: freshToken }),
    headers: { "Content-Type": "application/json" },
  });
  return cred.user;
}

export async function signInWithGoogle(): Promise<{ user: User; isNewUser: boolean }> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(getClientAuth(), provider);
  const token = await cred.user.getIdToken();
  // Persist session cookie
  await fetch("/api/v1/session", {
    method: "POST",
    body: JSON.stringify({ token }),
    headers: { "Content-Type": "application/json" },
  });
  const result = await cred.user.getIdTokenResult();
  const isNewUser = !result.claims.role;
  return { user: cred.user, isNewUser };
}

export async function signOut(): Promise<void> {
  await fbSignOut(getClientAuth());
  // Best-effort cookie clear — don't throw if network fails
  try { await fetch("/api/v1/session", { method: "DELETE" }); } catch { /* ignore */ }
}

export async function getIdToken(): Promise<string | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function createAccount(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getClientAuth(), email, password);
  return cred.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getClientAuth(), email);
}

export { onAuthStateChanged, onIdTokenChanged };
export type { User };
