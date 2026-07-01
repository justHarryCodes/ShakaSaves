import { NextRequest, NextResponse } from "next/server";
import { verifyRequestToken, unauthorizedResponse } from "@/lib/auth";
import type { DecodedToken, UserRole, ApiResult } from "@/types";

export function getIpFromRequest(req: Request | NextRequest): string {
  const forwarded = (req as NextRequest).headers?.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data } satisfies ApiResult<T>, { status });
}

export function err(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } } satisfies ApiResult, { status });
}

export function validationError(message: string): NextResponse {
  return err("VALIDATION_ERROR", message, 422);
}

export function notFound(message = "Not found"): NextResponse {
  return err("NOT_FOUND", message, 404);
}

export function serverError(message = "Internal server error"): NextResponse {
  return err("INTERNAL_ERROR", message, 500);
}

export async function withAuth(
  req: NextRequest,
  handler: (decoded: DecodedToken) => Promise<NextResponse>
): Promise<NextResponse> {
  const decoded = await verifyRequestToken(req);
  if (!decoded) return unauthorizedResponse();
  return handler(decoded);
}

export async function withRole(
  req: NextRequest,
  role: UserRole,
  handler: (decoded: DecodedToken) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(req, async (decoded) => {
    if (decoded.role !== role) return err("FORBIDDEN", "Insufficient permissions", 403);
    return handler(decoded);
  });
}

export async function withFinancialAuth(
  req: NextRequest,
  handler: (decoded: DecodedToken) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(req, handler);
}

export function getAdminEmail(): string {
  return process.env.SENDGRID_FROM_EMAIL ?? "";
}
