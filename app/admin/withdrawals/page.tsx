"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { WithdrawalStatusTabs } from "@/components/admin/withdrawals/WithdrawalStatusTabs";
import { WithdrawalList } from "@/components/admin/withdrawals/WithdrawalList";
import { toast } from "sonner";
import type { Withdrawal, WithdrawalStatus } from "@/types";

export default function WithdrawalsPage() {
  const { idToken } = useAuth();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [tab, setTab] = useState<WithdrawalStatus>("pending");

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

  const counts: Record<WithdrawalStatus, number> = {
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

      {/* Tab bar — its own row, visually separate from the content card below */}
      <WithdrawalStatusTabs active={tab} counts={counts} onChange={setTab} />

      {/* Content card — separate bordered block below the tabs */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden -mt-px" style={{ background: "#0D0D0D" }}>
        <WithdrawalList
          items={byStatus(tab)}
          loading={loading}
          markingPaid={markingPaid}
          onSelect={(w) => router.push(`/admin/withdrawals/${w.id}`)}
          onMarkPaid={markPaid}
        />
      </div>
    </div>
  );
}
