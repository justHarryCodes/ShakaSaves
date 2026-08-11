/**
 * Shared date formatting utilities.
 *
 * Firebase Admin SDK v13 serialises Firestore Timestamps as
 *   { _seconds: number, _nanoseconds: number }   ← underscore prefix
 * NOT { seconds, nanoseconds } as older versions did.
 * Every helper here handles all known serialisation variants:
 *   - Actual Timestamp object (server-side) with .toMillis() / .toDate()
 *   - firebase-admin v13 JSON: { _seconds, _nanoseconds }
 *   - Older JSON: { seconds, nanoseconds }
 *   - JavaScript Date
 *   - ISO / numeric strings
 *   - Plain numbers (already ms)
 */

export function tsToMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return isNaN(ms) ? null : ms;
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime();
  const o = v as Record<string, unknown>;
  // Actual Firestore Timestamp (server-side only)
  if (typeof o.toMillis === "function") return (o.toMillis as () => number)();
  // firebase-admin v13 JSON serialisation
  if (typeof o._seconds === "number") return o._seconds * 1000;
  // Older @google-cloud/firestore JSON serialisation
  if (typeof o.seconds === "number") return o.seconds * 1000;
  return null;
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** Format a Firestore timestamp (any serialisation) as "12 Aug 2025". */
export function fmtDate(v: unknown): string {
  const ms = tsToMs(v);
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString("en-NG", DATE_OPTS);
}

/** Format a Firestore timestamp as "12 Aug 2025, 03:45 PM". */
export function fmtDateTime(v: unknown): string {
  const ms = tsToMs(v);
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString("en-NG", DATETIME_OPTS);
}

/** Relative time: "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(v: unknown): string {
  const ms = tsToMs(v);
  if (ms == null) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
