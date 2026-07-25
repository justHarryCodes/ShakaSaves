"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FolderInput, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MigrationImportRequest, MigrationSubAccount } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
}
function fmtDate(ts: unknown) {
  const s = (ts as { seconds?: number })?.seconds;
  return s
    ? new Date(s * 1000).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}

const TABS = [
  { value: "pending",  label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function SubAccountRow({ sub }: { sub: MigrationSubAccount }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-zinc-400 w-24 shrink-0">{sub.category}</span>
      <span className="text-zinc-500 w-16 text-right">{sub.dailyMarking}d</span>
      <span className="text-zinc-300 w-24 text-right font-mono">{naira(sub.totalSavings)}</span>
      <span className="text-red-400/80 w-20 text-right font-mono">-{naira(sub.amountWtd)}</span>
      <span className="text-gold-400 w-20 text-right font-mono font-semibold">{naira(sub.cardBal)}</span>
    </div>
  );
}

function ReviewModal({
  req,
  idToken,
  onClose,
  onDone,
}: {
  req: MigrationImportRequest;
  idToken: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const totalBal = req.subAccounts.reduce((s, a) => s + a.cardBal, 0);
  const totalSaved = req.subAccounts.reduce((s, a) => s + a.totalSavings, 0);

  async function handleApprove() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/card-migrations/${req.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Migration approved — ${json.data.cardsCreated} card(s) created`);
        onDone();
        onClose();
      } else {
        toast.error(json.error?.message ?? "Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!reason.trim()) { toast.error("Provide a rejection reason"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/card-migrations/${req.id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Migration rejected");
        onDone();
        onClose();
      } else {
        toast.error(json.error?.message ?? "Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Review migration — {req.migrationCode}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Customer info */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-white">{req.customerName}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Submitted {fmtDate(req.submittedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-500">Total balance</p>
                <p className="text-base font-bold text-gold-400">{naira(totalBal)}</p>
              </div>
            </div>

            {/* Sub-accounts table */}
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2"
              >
                {req.subAccounts.length} sub-account{req.subAccounts.length > 1 ? "s" : ""}
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {expanded && (
                <div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-600 uppercase tracking-wider pb-1 border-b border-white/[0.04]">
                    <span className="w-24">Category</span>
                    <span className="w-16 text-right">Days</span>
                    <span className="w-24 text-right">Total saved</span>
                    <span className="w-20 text-right">Withdrawn</span>
                    <span className="w-20 text-right">Balance</span>
                  </div>
                  {req.subAccounts.map((sub, i) => (
                    <SubAccountRow key={i} sub={sub} />
                  ))}
                  <div className="flex justify-between text-xs pt-2 font-semibold">
                    <span className="text-zinc-500">Grand total</span>
                    <span className="text-gold-400">{naira(totalBal)} bal / {naira(totalSaved)} saved</span>
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
              <Button
                onClick={() => setAction("reject")}
                variant="outline"
                className="h-10 rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/[0.08] bg-transparent"
              >
                <XCircle size={14} className="mr-1.5" /> Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {loading ? "Approving…" : "Approve"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setAction(null)}
                variant="outline"
                className="h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent"
              >
                ← Back
              </Button>
              <Button
                onClick={handleReject}
                disabled={loading || !reason.trim()}
                className="h-10 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-semibold disabled:opacity-50"
              >
                {loading ? "Rejecting…" : "Confirm reject"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CardMigrationsPage() {
  const { idToken } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<MigrationImportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<MigrationImportRequest | null>(null);

  const fetchAll = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/card-migrations?status=${tab}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) setRequests(json.data.requests);
    } finally {
      setLoading(false);
    }
  }, [idToken, tab]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Card Migrations</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Review customers importing their physical savings card records
        </p>
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
            {tab === value && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gold-400" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-20 text-center">
          <FolderInput size={28} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No {tab} migration requests</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-5 py-3 font-medium">
                  Customer
                </th>
                <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium">
                  Code
                </th>
                <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium hidden sm:table-cell">
                  Accounts
                </th>
                <th className="text-left text-[11px] text-zinc-600 uppercase tracking-wider px-4 py-3 font-medium hidden sm:table-cell">
                  Date
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {requests.map((r) => {
                const totalBal = r.subAccounts.reduce((s, a) => s + a.cardBal, 0);
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-white">{r.customerName}</p>
                      <p className="text-xs text-gold-400 font-mono mt-0.5">{naira(totalBal)}</p>
                      {r.rejectionReason && (
                        <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[160px]">
                          {r.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-mono font-bold text-white/70 bg-white/[0.06] px-2 py-1 rounded-md">
                        {r.migrationCode}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <p className="text-xs text-zinc-400">{r.subAccounts.length} account{r.subAccounts.length > 1 ? "s" : ""}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {r.subAccounts.map((s) => s.category).join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <p className="text-xs text-zinc-500">{fmtDate(r.submittedAt)}</p>
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
                      {r.status === "approved" && (
                        <span className="text-xs text-emerald-400 font-medium">Approved</span>
                      )}
                      {r.status === "rejected" && (
                        <span className="text-xs text-red-400 font-medium">Rejected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
