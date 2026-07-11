"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContributionUpdateRequest } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(ts: unknown) {
  const s = (ts as { seconds?: number })?.seconds;
  return s ? new Date(s * 1000).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function ReviewModal({
  req,
  idToken,
  onClose,
  onDone,
}: {
  req: ContributionUpdateRequest;
  idToken: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/contribution-updates/${req.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) { toast.success("Rate update approved"); onDone(); onClose(); }
      else toast.error(json.error?.message ?? "Failed");
    } finally { setLoading(false); }
  }

  async function handleReject() {
    if (!reason.trim()) { toast.error("Provide a reason"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/contribution-updates/${req.id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (json.success) { toast.success("Rate update rejected"); onDone(); onClose(); }
      else toast.error(json.error?.message ?? "Failed");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Review rate update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 text-sm">
            <p className="text-zinc-300 font-semibold">{req.customerName}</p>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Current rate</span>
              <span className="text-white font-medium">{naira(req.currentAmount)}/day</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Requested rate</span>
              <span className="text-gold-400 font-semibold">{naira(req.requestedAmount)}/day</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Submitted</span>
              <span className="text-zinc-400">{fmtDate(req.requestedAt)}</span>
            </div>
          </div>

          {action === "reject" && (
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Reason for rejection</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-red-500/40"
                placeholder="Explain why this request is declined…"
              />
            </div>
          )}

          {!action ? (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setAction("reject")} variant="outline"
                className="h-10 rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/[0.08] bg-transparent">
                <XCircle size={14} className="mr-1.5" /> Reject
              </Button>
              <Button onClick={handleApprove} disabled={loading}
                className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">
                <CheckCircle2 size={14} className="mr-1.5" /> Approve
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setAction(null)} variant="outline"
                className="h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent">
                ← Back
              </Button>
              <Button onClick={handleReject} disabled={loading || !reason.trim()}
                className="h-10 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-semibold disabled:opacity-50">
                {loading ? "Rejecting…" : "Confirm reject"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContributionUpdatesPage() {
  const { idToken } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<ContributionUpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<ContributionUpdateRequest | null>(null);

  const fetchAll = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/contribution-updates?status=${tab}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) setRequests(json.data.requests);
    } finally { setLoading(false); }
  }, [idToken, tab]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Contribution Rate Updates</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Review customer requests to change their daily contribution rate</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06]">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "relative px-5 py-3 text-sm font-medium transition-colors",
              tab === value ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {label}
            {tab === value && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gold-400" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-20 text-center">
          <RefreshCw size={28} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No {tab} rate update requests</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-5 py-3 font-medium">Customer</th>
                <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium">Current</th>
                <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium">Requested</th>
                <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-white">{r.customerName}</p>
                    {r.rejectionReason && (
                      <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[160px]">{r.rejectionReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-mono text-zinc-400">{naira(r.currentAmount)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-mono font-bold text-gold-400">{naira(r.requestedAmount)}</p>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <p className="text-xs text-zinc-500">{fmtDate(r.requestedAt)}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {r.status === "pending" && (
                      <button
                        onClick={() => setReviewing(r)}
                        className="text-xs text-zinc-400 hover:text-white border border-white/[0.08] hover:border-white/[0.2] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Review
                      </button>
                    )}
                    {r.status === "approved" && <span className="text-xs text-emerald-400 font-medium">Approved</span>}
                    {r.status === "rejected" && <span className="text-xs text-red-400 font-medium">Rejected</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <ReviewModal
          req={reviewing}
          idToken={idToken!}
          onClose={() => setReviewing(null)}
          onDone={fetchAll}
        />
      )}
    </div>
  );
}
