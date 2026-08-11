"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { WithdrawalStatusBadge } from "@/components/shared/WithdrawalStatusBadge";
import { toast } from "sonner";
import { ChevronRight, Banknote } from "lucide-react";
import type { Withdrawal, WithdrawalStatus } from "@/types";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/utils/fmt-date";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

export default function WithdrawalsPage() {
  const { idToken } = useAuth();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    const res = await fetch("/api/v1/withdrawals?limit=100", { headers: { Authorization: `Bearer ${idToken}` } });
    const json = await res.json();
    if (json.success) setWithdrawals(json.data.withdrawals);
    setLoading(false);
  }, [idToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function markPaid(w: Withdrawal, e: React.MouseEvent) {
    e.stopPropagation();
    setMarkingPaid(w.id);
    try {
      const res = await fetch(`/api/v1/withdrawals/${w.id}/mark-paid`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) { toast.success("Marked as paid"); await fetchAll(); }
      else toast.error(json.error?.message ?? "Failed");
    } finally {
      setMarkingPaid(null);
    }
  }

  const byStatus = (status: WithdrawalStatus) => withdrawals.filter((w) => w.status === status);

  function WithdrawalList({ items }: { items: Withdrawal[] }) {
    if (loading) {
      return (
        <div className="p-4 space-y-2">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />)}
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
            onClick={() => router.push(`/admin/withdrawals/${w.id}`)}
            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors group"
          >
            {/* Amount */}
            <div className="min-w-[110px]">
              <p className="text-base font-bold" style={{ color: "#D4AF37" }}>{naira(w.amountRequested)}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">{fmtDate(w.requestedAt)}</p>
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

            {/* Mark paid (approved only) — stops propagation so row click doesn't fire */}
            {w.status === "approved" && (
              <button
                onClick={(e) => markPaid(w, e)}
                disabled={markingPaid === w.id}
                className={cn(
                  "shrink-0 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
                )}
              >
                {markingPaid === w.id ? "…" : <span className="flex items-center gap-1"><Banknote size={12} /> Mark paid</span>}
              </button>
            )}

            {/* Arrow */}
            <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  const counts = {
    pending:  byStatus("pending").length,
    approved: byStatus("approved").length,
    paid:     byStatus("paid").length,
    rejected: byStatus("rejected").length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white">Withdrawals</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Tap a row to view details and approve or reject</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: "#0D0D0D" }}>
        <Tabs defaultValue="pending">
          <div className="px-4 pt-4 border-b border-white/[0.06]">
            <TabsList className="bg-white/[0.04] border border-white/[0.06] h-9 p-0.5">
              {(["pending","approved","paid","rejected"] as WithdrawalStatus[]).map((s) => (
                <TabsTrigger
                  key={s}
                  value={s}
                  className="h-8 px-3 text-xs font-medium capitalize data-[state=active]:text-black data-[state=active]:font-semibold rounded-lg"
                  style={{ ["--tw-data-active-bg" as string]: "#D4AF37" }}
                >
                  {s}
                  {counts[s] > 0 && (
                    <span className="ml-1.5 opacity-70">{counts[s]}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {(["pending","approved","paid","rejected"] as WithdrawalStatus[]).map((status) => (
            <TabsContent key={status} value={status} className="mt-0">
              <WithdrawalList items={byStatus(status)} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
