export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { listMigrationRequests } from "@/lib/firestore/migration-imports";

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const status = req.nextUrl.searchParams.get("status") as
      | "pending"
      | "approved"
      | "rejected"
      | null;
    const requests = await listMigrationRequests(status ?? undefined);
    return ok({ requests });
  });
}
