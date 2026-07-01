"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithCustomToken as fbSignInWithCustomToken,
  signOut as fbSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  type Auth,
  type User,
} from "firebase/auth";

// Firebase client SDK is used ONLY for exchanging custom tokens and getting ID tokens.
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

export const clientAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (getClientAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export interface LoginResult {
  user: User;
  requiresPasswordChange: boolean;
}

export async function customLogin(email: string, password: string): Promise<LoginResult> {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message ?? "Login failed");
  }
  const { customToken, requiresPasswordChange } = json.data as { customToken: string; requiresPasswordChange: boolean };
  const cred = await fbSignInWithCustomToken(getClientAuth(), customToken);
  const freshToken = await cred.user.getIdToken(true);
  await fetch("/api/v1/session", {
    method: "POST",
    body: JSON.stringify({ token: freshToken }),
    headers: { "Content-Type": "application/json" },
  });
  return { user: cred.user, requiresPasswordChange };
}

export async function signInWithCustomToken(customToken: string): Promise<User> {
  const cred = await fbSignInWithCustomToken(getClientAuth(), customToken);
  const freshToken = await cred.user.getIdToken(true);
  await fetch("/api/v1/session", {
    method: "POST",
    body: JSON.stringify({ token: freshToken }),
    headers: { "Content-Type": "application/json" },
  });
  return cred.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(getClientAuth());
  try { await fetch("/api/v1/session", { method: "DELETE" }); } catch { /* ignore */ }
}

export async function getIdToken(): Promise<string | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export { onAuthStateChanged, onIdTokenChanged };
export type { User };
