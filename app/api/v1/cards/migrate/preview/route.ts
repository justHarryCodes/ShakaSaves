export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, err, notFound } from "@/lib/api-helpers";
import { MIGRATION_CARDS } from "@/lib/migration/records";
import { isCodeAlreadyApproved, getLatestCustomerMigration } from "@/lib/firestore/migration-imports";
import { getCustomerByUid } from "@/lib/firestore/customers";
import { cardTotals } from "@/lib/migration/migrationData";

export async function GET(req: NextRequest) {
  return withAuth(req, async (decoded) => {
    const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
    if (!code) return err("VALIDATION_ERROR", "Migration code is required", 422);

    const card = MIGRATION_CARDS.find((c) => c.migrationCode === code);
    if (!card) return notFound("Migration code not found");

    const [alreadyApproved, customer] = await Promise.all([
      isCodeAlreadyApproved(code),
      getCustomerByUid(decoded.uid),
    ]);

    if (alreadyApproved) return err("ALREADY_IMPORTED", "This migration code has already been imported", 409);
    if (!customer) return err("NO_PROFILE", "Customer profile not found", 404);

    const existing = await getLatestCustomerMigration(customer.id);

    return ok({
      card,
      totals: cardTotals(card),
      alreadySubmitted: existing?.status === "pending" && existing.migrationCode === code,
      existingStatus: existing?.status ?? null,
    });
  });
}
