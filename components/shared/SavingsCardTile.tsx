"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CreditCard, Calendar } from "lucide-react";

export interface SavingsCardTileProps {
  cardName: string;
  category?: string;
  dailyAmount: number;
  balance: number;
  migrated?: boolean;
  naira: (n: number) => string;

  // Present → renders the progress bar + last-5-days chips (dashboard's richer view).
  // Absent → simpler layout, no fabricated data (admin's current view).
  tickedPeriods?: string[];

  // Precomputed stats some callers (e.g. admin's card summary) already have
  // instead of a raw tickedPeriods array.
  daysMarked?: number;
  firstPeriod?: string;
  lastPeriod?: string;
  withdrawn?: number; // shown as a red "Withdrawn: ₦X" line when > 0

  // Navigation — pass exactly one, matching each page's existing UX:
  href?: string;         // whole tile is a Link (click anywhere)
  detailsHref?: string;  // explicit "Card details" button at the bottom
}

/**
 * One savings card's summary — shared between the customer dashboard and the
 * admin panel. Content degrades gracefully: pass `tickedPeriods` for the
 * richer dashboard view (progress bar + recent-days chips); omit it for the
 * simpler admin view. Fixed dark theme, no variant — matches the convention
 * already used everywhere else a card or calendar is shown in this app.
 */
export function SavingsCardTile({
  cardName, category, dailyAmount, balance, migrated, naira,
  tickedPeriods, daysMarked, firstPeriod, lastPeriod, withdrawn,
  href, detailsHref,
}: SavingsCardTileProps) {
  const days = tickedPeriods?.length ?? daysMarked ?? 0;
  const estimatedTotal = dailyAmount * 365;
  const pct = estimatedTotal > 0 ? Math.min(100, (balance / estimatedTotal) * 100) : 0;

  const body = (
    <div className={cn(
      "rounded-2xl border p-5 space-y-4",
      migrated ? "border-gold-500/20 bg-[#0D0D0D]" : "border-white/[0.07] bg-[#0D0D0D]",
      href && "cursor-pointer hover:border-white/[0.14] transition-colors"
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white truncate">{cardName}</h3>
            {category && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 border border-white/[0.08] shrink-0">
                {category}
              </span>
            )}
            {migrated && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20 shrink-0">
                Migrated
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {naira(dailyAmount)}/day
            {firstPeriod && lastPeriod && ` · ${firstPeriod} → ${lastPeriod}`}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-gold-500/20 shrink-0"
          style={{ background: "rgba(212,175,55,0.08)" }}>
          <CreditCard size={18} className="text-gold-400" />
        </div>
      </div>

      <div>
        <p className="text-xs text-zinc-600 uppercase tracking-wide">Balance</p>
        <p className="text-2xl font-bold text-white mt-0.5">{naira(balance)}</p>
        {withdrawn !== undefined && withdrawn > 0 && (
          <p className="text-xs text-red-400 mt-0.5">Withdrawn: {naira(withdrawn)}</p>
        )}
      </div>

      {tickedPeriods && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1"><Calendar size={11} /> {days} days marked</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #D4AF37, #B8962E)" }}
            />
          </div>
        </div>
      )}

      {tickedPeriods && tickedPeriods.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {tickedPeriods.slice(-5).map((p) => (
            <span key={p} className="text-[10px] font-mono bg-gold-500/10 text-gold-400 border border-gold-500/20 px-1.5 py-0.5 rounded">
              {p}
            </span>
          ))}
          {days > 5 && <span className="text-[10px] text-zinc-600 self-center">+{days - 5} more</span>}
        </div>
      )}

      {!tickedPeriods && daysMarked !== undefined && (
        <p className="text-xs text-zinc-500 flex items-center gap-1">
          <Calendar size={11} /> {daysMarked} days marked
        </p>
      )}

      {detailsHref && (
        <Link
          href={detailsHref}
          className="block w-full h-8 rounded-xl border border-white/[0.08] text-xs font-medium text-zinc-400 hover:text-white hover:border-white/[0.18] hover:bg-white/[0.03] transition-all text-center leading-8"
        >
          Card details
        </Link>
      )}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
