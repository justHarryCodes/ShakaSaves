"use client";
import { cn } from "@/lib/utils";
import type { WithdrawalStatus } from "@/types";

export const WITHDRAWAL_STATUSES: WithdrawalStatus[] = ["pending", "approved", "paid", "rejected"];

const TAB_BADGE_COLORS: Record<WithdrawalStatus, string> = {
  pending:  "bg-amber-500/15 text-amber-400",
  approved: "bg-blue-500/15 text-blue-400",
  paid:     "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

interface WithdrawalStatusTabsProps {
  active: WithdrawalStatus;
  counts: Record<WithdrawalStatus, number>;
  onChange: (status: WithdrawalStatus) => void;
}

export function WithdrawalStatusTabs({ active, counts, onChange }: WithdrawalStatusTabsProps) {
  return (
    <div className="flex border-b border-white/[0.06] overflow-x-auto">
      {WITHDRAWAL_STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            "relative px-5 py-3 text-sm font-medium capitalize transition-colors shrink-0",
            active === s ? "text-white" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {s}
          {counts[s] > 0 && (
            <span className={cn(
              "ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold",
              active === s ? TAB_BADGE_COLORS[s] : "bg-white/[0.05] text-zinc-600"
            )}>
              {counts[s]}
            </span>
          )}
          {active === s && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gold-400" />
          )}
        </button>
      ))}
    </div>
  );
}
