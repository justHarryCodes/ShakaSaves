export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { verifyToken, setCustomClaim, ADMIN_EMAILS } from "@/lib/auth";

// Public endpoint — caller must present a valid Firebase ID token.
// Grants role:admin only if the token's email is in the ADMIN_EMAILS whitelist.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return err("UNAUTHORIZED", "Token required", 401);

  try {
    const decoded = await verifyToken(authHeader.slice(7));
    if (!ADMIN_EMAILS.has(decoded.email ?? "")) {
      return err("FORBIDDEN", "Not an admin email", 403);
    }
    await setCustomClaim(decoded.uid, "admin");
    return ok({ message: "Admin role granted. Re-authenticate to activate." });
  } catch {
    return err("UNAUTHORIZED", "Invalid token", 401);
  }
}
