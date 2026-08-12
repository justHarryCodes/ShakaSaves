"use client";
import { Skeleton } from "@/components/ui/skeleton";
import { WithdrawalStatusBadge } from "@/components/shared/WithdrawalStatusBadge";
import { ChevronRight, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/utils/fmt-date";
import type { Withdrawal } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

interface WithdrawalListProps {
  items: Withdrawal[];
  loading: boolean;
  markingPaid: string | null;
  onSelect: (w: Withdrawal) => void;
  onMarkPaid: (w: Withdrawal, e: React.MouseEvent) => void;
}

export function WithdrawalList({ items, loading, markingPaid, onSelect, onMarkPaid }: WithdrawalListProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return <div className="py-12 text-center text-zinc-600 text-sm">None here</div>;
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {items.map((w) => (
        <div
          key={w.id}
          onClick={() => onSelect(w)}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors group"
        >
          {/* Amount + date — chevron rides along on mobile since the desktop one is hidden below */}
          <div className="flex items-start justify-between sm:block sm:min-w-[110px] sm:shrink-0">
            <div>
              <p className="text-base font-bold" style={{ color: "#D4AF37" }}>{naira(w.amountRequested)}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">{fmtDate(w.requestedAt)}</p>
            </div>
            <ChevronRight size={14} className="sm:hidden text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
          </div>

          {/* Status + customer ID */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <WithdrawalStatusBadge status={w.status} />
              {w.note && (
                <span className="text-[10px] text-zinc-600 italic truncate max-w-[160px]">&ldquo;{w.note}&rdquo;</span>
              )}
            </div>
            <p className="text-[10px] font-mono text-zinc-700 mt-0.5">{w.customerId.slice(-12).toUpperCase()}</p>
          </div>

          {/* Mark paid (approved only) — stops propagation so row click doesn't fire; full width on mobile */}
          {w.status === "approved" && (
            <button
              onClick={(e) => onMarkPaid(w, e)}
              disabled={markingPaid === w.id}
              className={cn(
                "w-full sm:w-auto shrink-0 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
              )}
            >
              {markingPaid === w.id ? "…" : <span className="flex items-center justify-center gap-1"><Banknote size={12} /> Mark paid</span>}
            </button>
          )}

          {/* Arrow — desktop only, mobile shows its own copy up top */}
          <ChevronRight size={14} className="hidden sm:block text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
        </div>
      ))}
    </div>
  );
}
