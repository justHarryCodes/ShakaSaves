"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import { SubmissionDetailModal } from "@/components/admin/SubmissionDetailModal";
import { toast } from "sonner";
import { ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentSubmission, PaymentStatus } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(ts: unknown): string {
  const secs = (ts as { seconds?: number })?.seconds;
  if (typeof secs !== "number") return "—";
  return new Date(secs * 1000).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

// ── Proof image lightbox ──────────────────────────────────────────────────
function ProofModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="relative max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-9 right-0 flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <X size={15} /> Close
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Payment proof"
          className="w-full rounded-2xl object-contain max-h-[80vh] border border-white/[0.08]"
        />
      </div>
    </div>
  );
}

// ── Tab config ─────────────────────────────────────────────────────────────
const TABS: { label: string; value: PaymentStatus }[] = [
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Rejected", value: "rejected" },
];

const BADGE_COLORS: Record<PaymentStatus, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  confirmed: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export default function PaymentsPage() {
  const { idToken } = useAuth();
  const [tab, setTab] = useState<PaymentStatus>("pending");
  const [byStatus, setByStatus] = useState<Record<PaymentStatus, PaymentSubmission[]>>({
    pending: [], confirmed: [], rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PaymentSubmission | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const [pending, confirmed, rejected] = await Promise.all(
        (["pending", "confirmed", "rejected"] as PaymentStatus[]).map((s) =>
          fetch(`/api/v1/payments?status=${s}&limit=50`, { headers: { Authorization: `Bearer ${idToken}` } })
            .then((r) => r.json())
            .then((j) => (j.success ? j.data.payments : []))
        )
      );
      setByStatus({ pending, confirmed, rejected });
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleConfirm(id: string, overrides: Record<string, number> = {}) {
    const res = await fetch(`/api/v1/payments/${id}/confirm`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Payment confirmed"); setSelected(null); await fetchAll(); }
    else toast.error(json.error?.message ?? "Failed");
  }

  async function handleReject(id: string, reason: string) {
    const res = await fetch(`/api/v1/payments/${id}/reject`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Payment rejected"); setSelected(null); await fetchAll(); }
    else toast.error(json.error?.message ?? "Failed");
  }

  const payments = byStatus[tab];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Payment Submissions</h2>
        <p className="text-zinc-500 text-sm mt-0.5">
          {byStatus.pending.length} pending review
        </p>
      </div>

      {/* Status tab navbar */}
      <div className="flex border-b border-white/[0.06]">
        {TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "relative px-5 py-3 text-sm font-medium transition-colors",
              tab === value ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {label}
            {byStatus[value].length > 0 && (
              <span className={cn(
                "ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold",
                tab === value ? BADGE_COLORS[value] : "bg-white/[0.05] text-zinc-600"
              )}>
                {byStatus[value].length}
              </span>
            )}
            {tab === value && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gold-400" />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden -mt-px">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg bg-white/[0.04]" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-3xl mb-3">✓</p>
            <p className="text-zinc-500 text-sm font-medium">Nothing here — all caught up</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-5 py-3 font-medium">Customer</th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium">Amount</th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium hidden md:table-cell">Cards</th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium">Status</th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium">Proof</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {payments.map((p) => {
                  const amount = p.totalAmount ?? p.amount ?? 0;
                  const cardLabel = p.cardAllocations?.length
                    ? p.cardAllocations.map((a) => a.cardName).join(", ")
                    : `${p.periodsCount ?? 0} × ${p.frequency ?? ""}`;

                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-white">{p.customerName}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-mono font-bold text-gold-400">{naira(amount)}</p>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <p className="text-xs text-zinc-400 max-w-[200px] truncate" title={cardLabel}>{cardLabel}</p>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <p className="text-xs text-zinc-500">{fmtDate(p.submittedAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <PaymentStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-4">
                        {p.proofImageUrl ? (
                          <button
                            onClick={() => setProofUrl(p.proofImageUrl!)}
                            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                          >
                            <ImageIcon size={13} />
                            View proof
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => setSelected(p)}
                          className="text-xs text-zinc-400 hover:text-white border border-white/[0.08] hover:border-white/[0.2] px-3 py-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProofModal url={proofUrl} onClose={() => setProofUrl(null)} />

      <SubmissionDetailModal
        submission={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    </div>
  );
}
