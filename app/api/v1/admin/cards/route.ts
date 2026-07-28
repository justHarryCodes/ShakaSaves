export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withRole, ok } from "@/lib/api-helpers";
import { db } from "@/lib/firebase-admin";
import type { SavingsCard, Customer } from "@/types";

export interface AdminCardRow {
  id: string;
  customerId: string;
  customerName: string;
  cardName: string;     // the card's own name / alias (e.g. "Flora 1" for migrated)
  category: string;     // savings plan category (e.g. "Regular", "FoodBank", "Project 1M")
  dailyAmount: number;
  daysMarked: number;
  totalSavings: number;
  withdrawn: number;
  balance: number;
  migrated: boolean;
  firstPeriod: string | null;
  lastPeriod: string | null;
  tickedPeriods: string[];
}

export interface CategorySummary {
  category: string;
  cardCount: number;
  totalSavings: number;
  withdrawn: number;
  balance: number;
}

export async function GET(req: NextRequest) {
  return withRole(req, "admin", async () => {
    const [cardsSnap, customersSnap] = await Promise.all([
      db.collection("savings_cards").orderBy("createdAt", "desc").get(),
      db.collection("customers").get(),
    ]);

    const customerMap = new Map<string, string>(
      customersSnap.docs.map((d) => [d.id, (d.data() as Customer).fullName])
    );

    const cards: AdminCardRow[] = cardsSnap.docs.map((doc) => {
      const c = doc.data() as SavingsCard;
      const sorted = (c.tickedPeriods ?? []).slice().sort();

      const totalSavings = c.migrated
        ? (c.migrationTotalSavings ?? c.currentBalance)
        : c.currentBalance;
      const withdrawn = c.migrated ? (c.migrationAmountWtd ?? 0) : 0;

      // category: explicit field if stored; fallback to cardName for non-migrated
      const category = c.category ?? (c.migrated ? "Regular" : (c.cardName ?? "General"));

      return {
        id: doc.id,
        customerId: c.customerId,
        customerName: customerMap.get(c.customerId) ?? c.customerName ?? "Unknown",
        cardName: c.cardName ?? "General",
        category,
        dailyAmount: c.dailyAmount ?? c.contributionAmount ?? 0,
        daysMarked: sorted.length,
        totalSavings,
        withdrawn,
        balance: c.currentBalance,
        migrated: c.migrated ?? false,
        firstPeriod: sorted[0] ?? null,
        lastPeriod: sorted[sorted.length - 1] ?? null,
        tickedPeriods: sorted,
      };
    });

    // Build per-category summaries (grouped by category, not cardName)
    const catMap = new Map<string, CategorySummary>();
    for (const card of cards) {
      const existing = catMap.get(card.category) ?? {
        category: card.category,
        cardCount: 0,
        totalSavings: 0,
        withdrawn: 0,
        balance: 0,
      };
      existing.cardCount++;
      existing.totalSavings += card.totalSavings;
      existing.withdrawn += card.withdrawn;
      existing.balance += card.balance;
      catMap.set(card.category, existing);
    }

    const categories = Array.from(catMap.values()).sort((a, b) =>
      b.totalSavings - a.totalSavings
    );

    return ok({ cards, categories });
  });
}
