"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import { Separator } from "@/components/ui/separator";
import type { PaymentSubmission } from "@/types";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

function ts(val: unknown): string {
  if (!val) return "—";
  if (typeof val === "object" && "toDate" in (val as object)) {
    return (val as { toDate(): Date }).toDate().toLocaleString();
  }
  return String(val);
}

interface SubmissionDetailModalProps {
  submission: PaymentSubmission | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: string, overrides: Record<string, number>) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}

export function SubmissionDetailModal({
  submission,
  open,
  onClose,
  onConfirm,
  onReject,
}: SubmissionDetailModalProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  // day overrides per card: { [cardId]: newDayCount }
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  if (!submission) return null;

  const isNewFormat = !!(submission.cardAllocations?.length);
  const displayAmount = submission.totalAmount ?? submission.amount ?? 0;

  async function handleConfirm() {
    setLoading(true);
    try {
      // Convert override strings to numbers, only send if different from calculated
      const numOverrides: Record<string, number> = {};
      if (isNewFormat && submission!.cardAllocations) {
        for (const alloc of submission!.cardAllocations) {
          const val = overrides[alloc.cardId];
          if (val !== undefined && val !== "") {
            const n = parseInt(val, 10);
            if (Number.isFinite(n) && n > 0) numOverrides[alloc.cardId] = n;
          }
        }
      }
      await onConfirm(submission!.id, numOverrides);
      onClose();
    } finally { setLoading(false); }
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setLoading(true);
    try { await onReject(submission!.id, reason); onClose(); }
    finally { setLoading(false); setReason(""); setRejecting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0D0D0D] border border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            Payment Submission
            <PaymentStatusBadge status={submission.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Customer & amount summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Customer</p>
              <p className="font-semibold text-white">{submission.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Amount</p>
              <p className="font-mono font-bold text-gold-400">{naira(displayAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Submitted</p>
              <p className="text-sm text-zinc-300">{ts(submission.submittedAt)}</p>
            </div>
            {submission.reviewedAt && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Reviewed</p>
                <p className="text-sm text-zinc-300">{ts(submission.reviewedAt)}</p>
              </div>
            )}
          </div>

          {/* ── New format: card allocations ── */}
          {isNewFormat && submission.cardAllocations && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Card Allocations</p>
              <div className="space-y-2">
                {submission.cardAllocations.map((alloc) => {
                  const calculated = alloc.daysToMark;
                  const override = overrides[alloc.cardId];
                  const displayDays = override !== undefined && override !== "" ? parseInt(override, 10) : (alloc.daysOverride ?? calculated);
                  return (
                    <div key={alloc.cardId} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">{alloc.cardName}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {naira(alloc.amount)} · {calculated} days calculated
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-zinc-600 mb-1">Days to mark</p>
                          {submission.status === "pending" ? (
                            <Input
                              type="number"
                              min={1}
                              value={override !== undefined ? override : (alloc.daysOverride ?? calculated).toString()}
                              onChange={(e) => setOverrides((prev) => ({ ...prev, [alloc.cardId]: e.target.value }))}
                              className="w-24 h-8 text-sm text-right bg-white/[0.04] border-white/[0.08] text-white rounded-lg"
                            />
                          ) : (
                            <p className="text-sm font-bold text-gold-400">{displayDays}d</p>
                          )}
                        </div>
                      </div>
                      {override !== undefined && override !== "" && parseInt(override, 10) !== calculated && (
                        <p className="text-xs text-amber-400 mt-2">
                          Override: {override} days (calculated was {calculated})
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Legacy format: proof image + periods ── */}
          {!isNewFormat && (
            <>
              {submission.proofImageUrl && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Payment Proof</p>
                  <a href={submission.proofImageUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={submission.proofImageUrl}
                      alt="Payment proof"
                      className="w-full max-h-72 object-contain rounded-xl border border-white/[0.06] bg-white/[0.02] hover:opacity-90 transition-opacity cursor-zoom-in"
                    />
                  </a>
                  <p className="text-xs text-zinc-600 mt-1">Click to open full size</p>
                </div>
              )}
              {submission.periods && submission.periods.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                    Selected Periods ({submission.periods.length} × {submission.frequency})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {submission.periods.map((p) => (
                      <span key={p} className="text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-1 rounded-md font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {submission.note && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Customer Note</p>
              <p className="text-sm text-zinc-300 italic">&quot;{submission.note}&quot;</p>
            </div>
          )}

          {submission.rejectionReason && (
            <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
              <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-1">Rejection Reason</p>
              <p className="text-sm text-red-300">{submission.rejectionReason}</p>
            </div>
          )}

          <Separator className="bg-white/[0.05]" />

          {/* Actions */}
          {submission.status === "pending" && (
            <div className="space-y-3">
              {rejecting ? (
                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-zinc-400 text-xs">Rejection reason (required)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Explain why this payment cannot be confirmed..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="bg-white/[0.04] border-white/[0.08] text-white"
                  />
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={handleReject} disabled={!reason.trim() || loading} className="flex-1">
                      {loading ? "Rejecting…" : "Confirm Rejection"}
                    </Button>
                    <Button variant="outline" onClick={() => { setRejecting(false); setReason(""); }}
                      className="border-white/10 text-zinc-400">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={handleConfirm} disabled={loading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-10 rounded-xl">
                    {loading ? "Confirming…" : "✓ Confirm Payment"}
                  </Button>
                  <Button variant="outline" onClick={() => setRejecting(true)}
                    className="flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10 h-10 rounded-xl">
                    ✗ Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
