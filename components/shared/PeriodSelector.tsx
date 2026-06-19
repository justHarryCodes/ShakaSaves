"use client";

import { cn } from "@/lib/utils";
import type { ContributionFrequency } from "@/types";

function naira(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

interface PeriodSelectorProps {
  frequency: ContributionFrequency;
  contributionAmount: number;
  confirmedPeriods: string[];
  pendingPeriods: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  year?: number;
  month?: number;
}

export function PeriodSelector({
  frequency,
  contributionAmount,
  confirmedPeriods,
  pendingPeriods,
  selected,
  onChange,
  year,
  month,
}: PeriodSelectorProps) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  const confirmed = new Set(confirmedPeriods);
  const pending = new Set(pendingPeriods);
  const sel = new Set(selected);

  function toggle(period: string) {
    if (confirmed.has(period) || pending.has(period)) return;
    const next = new Set(sel);
    if (next.has(period)) next.delete(period);
    else next.add(period);
    onChange(Array.from(next));
  }

  const total = selected.length * contributionAmount;

  if (frequency === "daily") {
    const days = getDaysInMonth(y, m);
    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {monthNames[m - 1]} {y}
        </h3>
        <div className="grid grid-cols-7 gap-1.5">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
            <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
          ))}
          {Array.from({ length: 35 }).map((_, i) => {
            const day = i + 1;
            const dateStr = day <= days ? `${y}-${pad(m)}-${pad(day)}` : null;
            const isConfirmed = dateStr ? confirmed.has(dateStr) : false;
            const isPending = dateStr ? pending.has(dateStr) : false;
            const isSelected = dateStr ? sel.has(dateStr) : false;

            return (
              <button
                key={i}
                type="button"
                disabled={!dateStr || isConfirmed || isPending}
                onClick={() => dateStr && toggle(dateStr)}
                className={cn(
                  "aspect-square rounded-lg text-xs font-semibold transition-all",
                  !dateStr && "invisible",
                  isConfirmed && "bg-emerald-500 text-white cursor-not-allowed",
                  isPending && "border-2 border-amber-400 text-amber-600 bg-transparent cursor-not-allowed",
                  isSelected && !isConfirmed && !isPending && "bg-blue-600 text-white",
                  !isConfirmed && !isPending && !isSelected && dateStr &&
                    "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                )}
              >
                {dateStr ? day : ""}
              </button>
            );
          })}
        </div>
        <SummaryBar amount={total} count={selected.length} unit="day" />
      </div>
    );
  }

  if (frequency === "weekly") {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">{y}</h3>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const weekStr = `${y}-W${pad(i + 1)}`;
            const isConfirmed = confirmed.has(weekStr);
            const isPending = pending.has(weekStr);
            const isSelected = sel.has(weekStr);

            return (
              <button
                key={weekStr}
                type="button"
                disabled={isConfirmed || isPending}
                onClick={() => toggle(weekStr)}
                className={cn(
                  "w-full p-3 rounded-lg text-sm font-medium text-left transition-all",
                  isConfirmed && "bg-emerald-500 text-white cursor-not-allowed",
                  isPending && "border-2 border-amber-400 text-amber-600 cursor-not-allowed",
                  isSelected && !isConfirmed && !isPending && "bg-blue-600 text-white",
                  !isConfirmed && !isPending && !isSelected &&
                    "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100"
                )}
              >
                Week {i + 1}{isConfirmed ? " ✓" : isPending ? " ⏳" : ""}
              </button>
            );
          })}
        </div>
        <SummaryBar amount={total} count={selected.length} unit="week" />
      </div>
    );
  }

  const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">{y}</h3>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }).map((_, i) => {
          const monthStr = `${y}-M${pad(i + 1)}`;
          const isConfirmed = confirmed.has(monthStr);
          const isPending = pending.has(monthStr);
          const isSelected = sel.has(monthStr);

          return (
            <button
              key={monthStr}
              type="button"
              disabled={isConfirmed || isPending}
              onClick={() => toggle(monthStr)}
              className={cn(
                "p-3 rounded-lg text-sm font-medium transition-all",
                isConfirmed && "bg-emerald-500 text-white cursor-not-allowed",
                isPending && "border-2 border-amber-400 text-amber-600 cursor-not-allowed",
                isSelected && !isConfirmed && !isPending && "bg-blue-600 text-white",
                !isConfirmed && !isPending && !isSelected &&
                  "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100"
              )}
            >
              {monthLabels[i]}
            </button>
          );
        })}
      </div>
      <SummaryBar amount={total} count={selected.length} unit="month" />
    </div>
  );
}

function SummaryBar({ amount, count, unit }: { amount: number; count: number; unit: string }) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-0 bg-[#0F172A] text-white rounded-xl p-4 flex items-center justify-between shadow-lg">
      <span className="text-sm text-slate-400">
        {count} {unit}{count !== 1 ? "s" : ""} selected
      </span>
      <span className="font-mono font-bold text-emerald-400 text-lg">{naira(amount)}</span>
    </div>
  );
}
