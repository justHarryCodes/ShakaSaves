"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FolderInput, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Clock, BadgeCheck, Ban, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MigrationImportRequest, MigrationSubAccount } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0,
  }).format(n);
}
function fmtDate(ts: unknown) {
  const s = (ts as { seconds?: number })?.seconds;
  return s
    ? new Date(s * 1000).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

const TABS = [
  { value: "pending",  label: "Pending",  icon: Clock,       color: "text-amber-400" },
  { value: "approved", label: "Approved", icon: BadgeCheck,  color: "text-emerald-400" },
  { value: "rejected", label: "Rejected", icon: Ban,         color: "text-red-400" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function StatusBadge({ status }: { status: Tab }) {
  const map = {
    pending:  { label: "Pending",  cls: "bg-amber-500/10  text-amber-400  border-amber-500/20"  },
    approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    rejected: { label: "Rejected", cls: "bg-red-500/10    text-red-400    border-red-500/20"    },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", cls)}>
      {label}
    </span>
  );
}

function SubAccountRow({ sub }: { sub: MigrationSubAccount }) {
  const days = sub.dailyMarking > 0 ? Math.round(sub.totalSavings / sub.dailyMarking) : 0;
  return (
    <div className="flex items-center text-xs py-1.5 border-b border-white/[0.04] last:border-0 gap-2">
      <span className="text-zinc-400 w-24 shrink-0">{sub.category}</span>
      <span className="text-zinc-500 w-12 text-right shrink-0">{days}d</span>
      <span className="text-zinc-300 w-28 text-right font-mono shrink-0">{naira(sub.totalSavings)}</span>
      <span className="text-red-400/80 w-28 text-right font-mono shrink-0">-{naira(sub.amountWtd)}</span>
      <span className="text-gold-400 w-28 text-right font-mono font-semibold shrink-0">{naira(sub.cardBal)}</span>
    </div>
  );
}

function ReviewModal({
  req, idToken, onClose, onDone,
}: { req: MigrationImportRequest; idToken: string; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const totalBal   = req.subAccounts.reduce((s, a) => s + a.cardBal, 0);
  const totalSaved = req.subAccounts.reduce((s, a) => s + a.totalSavings, 0);

  async function handleApprove() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/v1/admin/card-migrations/${req.id}/approve`, {
        method: "POST", headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) { toast.success(`Approved — ${json.data.cardsCreated} card(s) created`); onDone(); onClose(); }
      else toast.error(json.error?.message ?? "Failed");
    } finally { setLoading(false); }
  }

  async function handleReject() {
    if (!reason.trim()) { toast.error("Provide a rejection reason"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/v1/admin/card-migrations/${req.id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (json.success) { toast.success("Migration rejected"); onDone(); onClose(); }
      else toast.error(json.error?.message ?? "Failed");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-2xl w-full p-0 overflow-hidden">
        {/* Scrollable body */}
        <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <span className="text-xs font-mono text-white/50 bg-white/[0.06] px-2 py-0.5 rounded-md">{req.migrationCode}</span>
                Review migration
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-sm font-bold text-white">{req.customerName}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Submitted {fmtDate(req.submittedAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-zinc-500">Total balance</p>
                  <p className="text-base font-bold text-gold-400">{naira(totalBal)}</p>
                  <p className="text-[10px] text-zinc-600">{naira(totalSaved)} gross</p>
                </div>
              </div>

              <div>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2"
                >
                  {req.subAccounts.length} sub-account{req.subAccounts.length > 1 ? "s" : ""}
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {expanded && (
                  <div className="overflow-x-auto -mx-4 px-4">
                    <div style={{ minWidth: "480px" }}>
                      <div className="flex items-center text-[10px] text-zinc-600 uppercase tracking-wider pb-1 border-b border-white/[0.04] gap-2">
                        <span className="w-24 shrink-0">Category</span>
                        <span className="w-12 text-right shrink-0">Days</span>
                        <span className="w-28 text-right shrink-0">Total saved</span>
                        <span className="w-28 text-right shrink-0">Withdrawn</span>
                        <span className="w-28 text-right shrink-0">Balance</span>
                      </div>
                      {req.subAccounts.map((sub, i) => <SubAccountRow key={i} sub={sub} />)}
                      <div className="flex justify-between text-xs pt-2 font-semibold">
                        <span className="text-zinc-500">Grand total</span>
                        <span className="text-gold-400">{naira(totalBal)} bal · {naira(totalSaved)} saved</span>
                      </div>
                    </div>
                  </div>
                )}
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
                  <CheckCircle2 size={14} className="mr-1.5" />
                  {loading ? "Approving…" : "Approve"}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CardMigrationsPage() {
  const { idToken } = useAuth();
  const [tab, setTab]           = useState<Tab>("pending");
  const [requests, setRequests] = useState<MigrationImportRequest[]>([]);
  const [counts, setCounts]     = useState<Record<Tab, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading]   = useState(true);
  const [reviewing, setReviewing] = useState<MigrationImportRequest | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!idToken) return;
    const results = await Promise.all(
      (["pending", "approved", "rejected"] as Tab[]).map((s) =>
        fetch(`/api/v1/admin/card-migrations?status=${s}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }).then((r) => r.json())
      )
    );
    setCounts({
      pending:  results[0].success ? results[0].data.requests.length : 0,
      approved: results[1].success ? results[1].data.requests.length : 0,
      rejected: results[2].success ? results[2].data.requests.length : 0,
    });
  }, [idToken]);

  const fetchTab = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/v1/admin/card-migrations?status=${tab}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) setRequests(json.data.requests);
    } finally { setLoading(false); }
  }, [idToken, tab]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchTab(); }, [fetchTab]);

  function handleDone() { fetchCounts(); fetchTab(); }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Card Migrations</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Review customers importing their physical savings card records
        </p>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-3 gap-3">
        {TABS.map(({ value, label, icon: Icon, color }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              tab === value
                ? "border-white/[0.14] bg-white/[0.04]"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
            )}
          >
            <Icon size={16} className={cn("mb-2", color)} />
            <p className="text-2xl font-bold text-white tabular-nums">{counts[value]}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </button>
        ))}
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
            {counts[value] > 0 && tab !== value && (
              <span className="ml-1.5 text-[10px] bg-white/[0.08] text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                {counts[value]}
              </span>
            )}
            {tab === value && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gold-400" />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-20 text-center">
          <FolderInput size={28} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No {tab} migration requests</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          {/* Scrollable wrapper for mobile */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-5 py-3 font-medium whitespace-nowrap">
                    Customer
                  </th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">
                    Balance
                  </th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">
                    Code
                  </th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">
                    Sub-accounts
                  </th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">
                    Submitted
                  </th>
                  <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {requests.map((r) => {
                  const totalBal   = r.subAccounts.reduce((s, a) => s + a.cardBal, 0);
                  const seen = new Set<string>();
                  const categories: string[] = [];
                  r.subAccounts.forEach((s) => { if (!seen.has(s.category)) { seen.add(s.category); categories.push(s.category); } });
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                      {/* Customer */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-white">{r.customerName}</p>
                        {r.rejectionReason && (
                          <p className="text-[10px] text-red-400 mt-0.5 max-w-[160px] truncate">
                            {r.rejectionReason}
                          </p>
                        )}
                        {r.reviewedAt && r.status !== "pending" && (
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            Reviewed {fmtDate(r.reviewedAt)}
                          </p>
                        )}
                      </td>

                      {/* Balance */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gold-400 font-mono">{naira(totalBal)}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {naira(r.subAccounts.reduce((s, a) => s + a.totalSavings, 0))} gross
                        </p>
                      </td>

                      {/* Code */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs font-mono font-bold text-white/70 bg-white/[0.06] px-2 py-1 rounded-md">
                          {r.migrationCode}
                        </span>
                      </td>

                      {/* Sub-accounts */}
                      <td className="px-4 py-4">
                        <p className="text-xs text-zinc-300 whitespace-nowrap">
                          {r.subAccounts.length} account{r.subAccounts.length > 1 ? "s" : ""}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5 whitespace-nowrap">
                          {categories.join(" · ")}
                        </p>
                      </td>

                      {/* Submitted */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-xs text-zinc-500">{fmtDate(r.submittedAt)}</p>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={r.status as Tab} />
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        {r.status === "pending" ? (
                          <button
                            onClick={() => setReviewing(r)}
                            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-white/[0.08] hover:border-white/[0.2] px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Eye size={12} /> Review
                          </button>
                        ) : (
                          <button
                            onClick={() => setReviewing(r)}
                            className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 border border-white/[0.04] hover:border-white/[0.1] px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Eye size={12} /> View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Row count footer */}
          <div className="px-5 py-3 border-t border-white/[0.04] bg-white/[0.01]">
            <p className="text-[11px] text-zinc-600">
              {requests.length} {tab} request{requests.length !== 1 ? "s" : ""}
              {" · "}
              {naira(requests.reduce((s, r) => s + r.subAccounts.reduce((a, b) => a + b.cardBal, 0), 0))} total balance
            </p>
          </div>
        </div>
      )}

      {reviewing && (
        <ReviewModal
          req={reviewing}
          idToken={idToken!}
          onClose={() => setReviewing(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
