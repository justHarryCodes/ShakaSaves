export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    return ok({
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role ?? null,
    });
  });
}
