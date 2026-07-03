"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Clock, CheckCircle2, XCircle, CreditCard,
  ExternalLink, ChevronDown,
} from "lucide-react";
import type { CardRequest } from "@/types";
import { cn } from "@/lib/utils";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(ts: unknown) {
  const s = (ts as { seconds?: number })?.seconds;
  if (!s) return "—";
  return new Date(s * 1000).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_TABS = ["all", "pending", "approved", "rejected"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

// ── Reject modal ──────────────────────────────────────────────────────
function RejectModal({
  request,
  onClose,
  onDone,
  idToken,
}: {
  request: CardRequest;
  onClose: () => void;
  onDone: () => void;
  idToken: string;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReject() {
    if (!reason.trim()) { toast.error("Please provide a reason"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/card-requests/${request.id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Card request rejected");
        onDone();
        onClose();
      } else {
        toast.error(json.error?.message ?? "Failed to reject");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Reject card request</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400">
          Rejecting &quot;<span className="text-white">{request.cardName}</span>&quot; for{" "}
          <span className="text-white">{request.customerName}</span>.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400">Reason (sent to customer)</label>
          <textarea
            className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:border-red-500/40"
            placeholder="e.g. Proof image unclear, please resubmit…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}
            className="flex-1 h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent">
            Cancel
          </Button>
          <Button
            disabled={loading || !reason.trim()}
            onClick={handleReject}
            className="flex-1 h-10 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-semibold disabled:opacity-50"
          >
            {loading ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Approve confirm modal ─────────────────────────────────────────────
function ApproveModal({
  request,
  onClose,
  onDone,
  idToken,
}: {
  request: CardRequest;
  onClose: () => void;
  onDone: () => void;
  idToken: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/card-requests/${request.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`"${request.cardName}" approved — card created!`);
        onDone();
        onClose();
      } else {
        toast.error(json.error?.message ?? "Failed to approve");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Approve card request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-zinc-400">
            Approving <span className="text-white font-medium">&quot;{request.cardName}&quot;</span> for{" "}
            <span className="text-white font-medium">{request.customerName}</span>.
          </p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Daily amount</span>
              <span className="text-white font-medium">{naira(request.dailyAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">First payment</span>
              <span className="text-white font-medium">{naira(request.firstPaymentAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Days to mark</span>
              <span className="text-emerald-400 font-medium">{request.daysToMark} day{request.daysToMark !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <a
            href={request.proofImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300"
          >
            <ExternalLink size={12} /> View payment proof
          </a>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}
            className="flex-1 h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent">
            Cancel
          </Button>
          <Button
            disabled={loading}
            onClick={handleApprove}
            className="flex-1 h-10 rounded-xl font-semibold disabled:opacity-50 text-black"
            style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
          >
            {loading ? "Approving…" : "Approve & create card"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Request row ───────────────────────────────────────────────────────
function RequestRow({
  request,
  onAction,
  idToken,
}: {
  request: CardRequest;
  onAction: () => void;
  idToken: string;
}) {
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const statusBadge: Record<CardRequest["status"], { label: string; cls: string }> = {
    pending:  { label: "Pending",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  };
  const badge = statusBadge[request.status];

  return (
    <>
      <div className="rounded-xl border border-white/[0.06] bg-[#0D0D0D] overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-gold-500/20 shrink-0"
              style={{ background: "rgba(212,175,55,0.08)" }}>
              <CreditCard size={16} className="text-gold-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{request.cardName}</p>
              <p className="text-xs text-zinc-500 truncate">{request.customerName} · {fmtDate(request.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", badge.cls)}>
              {badge.label}
            </span>
            <ChevronDown size={14} className={cn("text-zinc-500 transition-transform", expanded && "rotate-180")} />
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04] pt-4">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-white/[0.03] p-3 space-y-1">
                <p className="text-zinc-500">Daily amount</p>
                <p className="text-white font-semibold">{naira(request.dailyAmount)}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 space-y-1">
                <p className="text-zinc-500">First payment</p>
                <p className="text-white font-semibold">{naira(request.firstPaymentAmount)}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 space-y-1">
                <p className="text-zinc-500">Days to mark</p>
                <p className="text-emerald-400 font-semibold">{request.daysToMark}</p>
              </div>
            </div>

            {request.rejectionReason && (
              <p className="text-xs text-red-400 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
                Reason: {request.rejectionReason}
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={request.proofImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 transition-colors"
              >
                <ExternalLink size={12} /> View proof
              </a>

              {request.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => setShowApprove(true)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-black"
                    style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
                  >
                    <CheckCircle2 size={13} className="mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowReject(true)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold border-red-500/30 text-red-400 hover:bg-red-500/[0.08] bg-transparent"
                  >
                    <XCircle size={13} className="mr-1" /> Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showApprove && (
        <ApproveModal
          request={request}
          idToken={idToken}
          onClose={() => setShowApprove(false)}
          onDone={onAction}
        />
      )}
      {showReject && (
        <RejectModal
          request={request}
          idToken={idToken}
          onClose={() => setShowReject(false)}
          onDone={onAction}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────
export default function CardRequestsPage() {
  const { idToken } = useAuth();
  const [requests, setRequests] = useState<CardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("pending");

  const fetchRequests = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/card-requests", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) setRequests(json.data.requests);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filtered = tab === "all" ? requests : requests.filter((r) => r.status === tab);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-white">Card Requests</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Review and approve customer savings card requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold capitalize transition-all",
              tab === t
                ? "bg-gold-500/15 text-gold-400 border border-gold-500/20"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t}
            {t === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center border border-white/[0.06] bg-white/[0.02]">
            {tab === "pending" ? (
              <Clock size={24} className="text-zinc-600" />
            ) : (
              <CreditCard size={24} className="text-zinc-600" />
            )}
          </div>
          <p className="text-sm text-zinc-500">No {tab === "all" ? "" : tab} card requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RequestRow key={r.id} request={r} onAction={fetchRequests} idToken={idToken!} />
          ))}
        </div>
      )}
    </div>
  );
}
