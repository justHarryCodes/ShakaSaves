"use client";
import { cn } from "@/lib/utils";
import type { BatchColor } from "@/lib/utils/classify-batches";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Every month renders as 31 slots — the app's virtual calendar treats every
// month as 31 days regardless of the real month length (see lib/utils/virtual-dates.ts).
const DAYS_IN_MONTH = 31;

interface SavingsMonthGridProps {
  year: number;
  month: number; // 0-indexed
  withdrawnSet: Set<string>;
  commissionSet: Set<string>;
  availableSet: Set<string>;
  /** day ("YYYY-MM-DD") → which payment batch it belongs to, for alternating colors.
   *  Days in availableSet with no entry here (e.g. migrated pre-history) render as
   *  the default green — that's what keeps migrated data out of the alternation. */
  batchColorByDay: Map<string, BatchColor>;
  dailyAmt: number;
  naira: (n: number) => string;
}

/**
 * One month of the savings calendar, shared by the customer and admin card
 * detail pages. Color precedence is fixed: withdrawn (red) beats commission
 * (gold) beats payment-batch color (alternating green/blue) beats unmarked.
 */
export function SavingsMonthGrid({
  year, month, withdrawnSet, commissionSet, availableSet, batchColorByDay, dailyAmt, naira,
}: SavingsMonthGridProps) {
  const monthStr = String(month + 1).padStart(2, "0");
  const firstWeekday = new Date(year, month, 1).getDay();

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {MONTH_NAMES[month]} <span className="text-zinc-500 font-medium">{year}</span>
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-[10px] text-zinc-600 font-medium text-center">{d}</span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: DAYS_IN_MONTH }, (_, i) => {
          const day = i + 1;
          const key = `${year}-${monthStr}-${String(day).padStart(2, "0")}`;
          const isWithdrawn  = withdrawnSet.has(key);
          const isCommission = commissionSet.has(key);
          const isAvailable  = availableSet.has(key);
          const isBlueBatch  = batchColorByDay.get(key) === "b";

          const title =
            isWithdrawn  ? `${MONTH_NAMES[month]} ${day}: withdrawn (${naira(dailyAmt)})` :
            isCommission ? `${MONTH_NAMES[month]} ${day}: admin commission` :
            isAvailable  ? `${MONTH_NAMES[month]} ${day}: ${naira(dailyAmt)}` : undefined;

          return (
            <div
              key={day}
              title={title}
              className={cn(
                "aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium transition-colors",
                isWithdrawn  ? "bg-red-500 text-white" :
                isCommission ? "text-black" :
                isAvailable  ? (isBlueBatch ? "bg-blue-500 text-white" : "bg-emerald-500 text-white") :
                               "text-zinc-600 hover:text-zinc-400"
              )}
              style={isCommission ? { background: "#D4AF37" } : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
