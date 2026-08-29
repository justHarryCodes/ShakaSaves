import { auth } from "@/lib/firebase-admin";
import type { DecodedToken, UserRole } from "@/types";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_USERNAMES = new Set(["shakasaves", "shakasave", "glitch2024"]);

export async function verifyToken(token: string): Promise<DecodedToken> {
  const decoded = await auth.verifyIdToken(token);
  return decoded as DecodedToken;
}

export async function getTokenFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export async function verifyRequestToken(req: NextRequest): Promise<DecodedToken | null> {
  const token = await getTokenFromRequest(req);
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function requireRole(decoded: DecodedToken, role: UserRole): boolean {
  return decoded.role === role;
}

export async function setCustomClaim(uid: string, role: UserRole): Promise<void> {
  await auth.setCustomUserClaims(uid, { role });
}

export async function getUserRecord(uid: string) {
  return auth.getUser(uid);
}

export async function createFirebaseUser(email: string, password: string, displayName: string) {
  return auth.createUser({ email, password, displayName });
}

export async function deleteFirebaseUser(uid: string) {
  return auth.deleteUser(uid);
}

/**
 * Finds the uid of the (first) Firebase Auth user with the admin custom claim,
 * for routes that need to notify the admin of something (new payment, new
 * withdrawal request, etc). Pages through every user rather than checking only
 * the first 1000 — auth.listUsers' order isn't creation-time, so a single
 * unpaginated call risks never seeing the admin at all once the user count
 * passes that page size, silently dropping the notification every time.
 */
export async function getAdminUid(): Promise<string> {
  try {
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      const admin = page.users.find((u) => u.customClaims?.role === "admin");
      if (admin) return admin.uid;
      pageToken = page.pageToken;
    } while (pageToken);
    return "";
  } catch {
    return ""; // caller notifies best-effort — a lookup failure shouldn't block the request
  }
}

export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message } },
    { status: 401 }
  );
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: "FORBIDDEN", message } },
    { status: 403 }
  );
}
