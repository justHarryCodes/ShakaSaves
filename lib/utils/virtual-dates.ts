/**
 * Virtual calendar where every month has exactly 31 days.
 * Period strings are "YYYY-MM-DD" where DD can be 01–31 regardless of the
 * real month length — Feb 29/30/31 and Apr/Jun/Sep/Nov 31 are valid periods.
 *
 * This matches the MonthGrid display which always renders 31 day slots.
 */

function str(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parse(period: string): [number, number, number] {
  return [
    parseInt(period.slice(0, 4)),
    parseInt(period.slice(5, 7)) - 1, // 0-indexed month
    parseInt(period.slice(8, 10)),
  ];
}

function advance(year: number, month: number, day: number): [number, number, number] {
  day++;
  if (day > 31) { day = 1; month++; }
  if (month > 11) { month = 0; year++; }
  return [year, month, day];
}

function generate(year: number, month: number, day: number, count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(str(year, month, day));
    [year, month, day] = advance(year, month, day);
  }
  return result;
}

/** For card-request approval: N periods starting from Jan 1 or today. */
export function generateDates(count: number, startFrom: "today" | "january"): string[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = startFrom === "january" ? 0 : now.getUTCMonth();
  const day   = startFrom === "january" ? 1 : now.getUTCDate();
  return generate(year, month, day, count);
}

/** For payment confirm: N periods continuing after the last ticked period. */
export function generateNextDates(sortedTickedPeriods: string[], count: number): string[] {
  if (count <= 0) return [];
  let year: number, month: number, day: number;
  if (sortedTickedPeriods.length > 0) {
    [year, month, day] = parse(sortedTickedPeriods[sortedTickedPeriods.length - 1]);
    [year, month, day] = advance(year, month, day);
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth();
    day = now.getUTCDate();
  }
  return generate(year, month, day, count);
}

/** For migration approval: N periods starting from a fixed anchor date. */
export function generateMigrationDates(anchorIso: string, count: number): string[] {
  const [year, month, day] = parse(anchorIso);
  return generate(year, month, day, count);
}
