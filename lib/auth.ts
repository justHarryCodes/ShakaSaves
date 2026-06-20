import { auth } from "@/lib/firebase-admin";
import type { DecodedToken, UserRole } from "@/types";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_UIDS = new Set([
  "pqJd9ASEOwhLZYzyFbBdTin4xSr2", // shakabizz247@gmail.com
  "tKhoR67zUacvWycQDuGkhezmKM73", // shakabiz247@mail.com
  "wbzPbdemiZPZU6g33dCzKUnUfJq1", // harryfrancis037@gmail.com
]);

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
