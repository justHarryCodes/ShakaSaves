export type Category = "Regular" | "FoodBank" | "Project 1M";

/** A row as parsed directly from the Google Sheet export.
 *  `migrationCode` is absent on continuation rows (same customer, different category). */
export interface RawRow {
  migrationCode?: string;
  customerName: string;
  dailyMarking: number;
  totalSavings: number;
  amountWtd: number;
  cardBal: number;
  adminCommission: number;
  category: Category;
}

/** After forward-fill: `migrationCode` is guaranteed to be present on every row. */
export interface MigrationRecord extends RawRow {
  migrationCode: string;
}

/** One savings sub-account belonging to a migration card (one per category). */
export interface SubAccount {
  category: Category;
  customerName: string;
  dailyMarking: number;
  totalSavings: number;
  amountWtd: number;
  cardBal: number;
  adminCommission: number;
}

/** One customer's complete migration card — 1 to 3 sub-accounts. */
export interface MigrationCard {
  migrationCode: string;
  primaryName: string;
  subAccounts: SubAccount[];
}

/** A name that appears under more than one migration code — possible accidental duplicate. */
export interface DuplicateCandidate {
  normalizedName: string;
  appearances: Array<{ migrationCode: string; rawName: string }>;
}

/** Totals across all sub-accounts on a card. */
export interface CardTotals {
  totalSavings: number;
  totalWtd: number;
  totalBal: number;
  totalCommission: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── core transforms ──────────────────────────────────────────────────────────

/**
 * Scans rows top-to-bottom, carrying the last seen non-blank migration code
 * forward onto continuation rows. Throws if the very first row has no code.
 */
export function forwardFill(rows: RawRow[]): MigrationRecord[] {
  let lastCode = "";
  return rows.map((row, i) => {
    const code = row.migrationCode?.trim();
    if (code) lastCode = code;
    if (!lastCode) {
      throw new Error(
        `Row ${i + 1} ("${row.customerName}") has no migration code and none has been seen yet`
      );
    }
    return { ...row, migrationCode: lastCode };
  });
}

/**
 * Groups forward-filled records by migration code.
 * The primary name is taken from the first row per code (the one that carried the code).
 */
export function groupByMigrationCode(rows: RawRow[]): MigrationCard[] {
  const filled = forwardFill(rows);
  const map = new Map<string, MigrationRecord[]>();
  for (const r of filled) {
    const list = map.get(r.migrationCode) ?? [];
    list.push(r);
    map.set(r.migrationCode, list);
  }
  return Array.from(map.entries()).map(([code, records]) => ({
    migrationCode: code,
    primaryName: records[0].customerName,
    subAccounts: records.map((r) => ({
      category: r.category,
      customerName: r.customerName,
      dailyMarking: r.dailyMarking,
      totalSavings: r.totalSavings,
      amountWtd: r.amountWtd,
      cardBal: r.cardBal,
      adminCommission: r.adminCommission,
    })),
  }));
}

/**
 * Finds names that appear under more than one migration code after normalization
 * (lowercase, strip punctuation, collapse whitespace).
 * This catches the most common case — slight name variations for the same person —
 * without fuzzy matching that would generate false positives.
 * Admin must review results manually.
 */
export function findDuplicateCandidates(
  records: MigrationRecord[]
): DuplicateCandidate[] {
  const seen = new Map<string, Array<{ migrationCode: string; rawName: string }>>();

  for (const r of records) {
    const norm = normalizeName(r.customerName);
    const list = seen.get(norm) ?? [];
    if (!list.some((e) => e.migrationCode === r.migrationCode)) {
      list.push({ migrationCode: r.migrationCode, rawName: r.customerName });
    }
    seen.set(norm, list);
  }

  const candidates: DuplicateCandidate[] = [];
  seen.forEach((appearances, normalizedName) => {
    const uniqueCodes = new Set(appearances.map((a: { migrationCode: string }) => a.migrationCode));
    if (uniqueCodes.size > 1) {
      candidates.push({ normalizedName, appearances });
    }
  });
  return candidates;
}

// ─── utility helpers ──────────────────────────────────────────────────────────

export function findCardByCode(
  cards: MigrationCard[],
  code: string
): MigrationCard | undefined {
  return cards.find((c) => c.migrationCode === code.trim().toUpperCase());
}

/** True if a code is already represented in the list (guard against re-import). */
export function isDuplicateCode(cards: MigrationCard[], code: string): boolean {
  return cards.some((c) => c.migrationCode === code.trim().toUpperCase());
}

/** Aggregates balances across all sub-accounts on a single card. */
export function cardTotals(card: MigrationCard): CardTotals {
  return card.subAccounts.reduce(
    (acc, s) => ({
      totalSavings: acc.totalSavings + s.totalSavings,
      totalWtd: acc.totalWtd + s.amountWtd,
      totalBal: acc.totalBal + s.cardBal,
      totalCommission: acc.totalCommission + s.adminCommission,
    }),
    { totalSavings: 0, totalWtd: 0, totalBal: 0, totalCommission: 0 }
  );
}
