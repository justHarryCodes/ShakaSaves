"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import { Separator } from "@/components/ui/separator";
import type { PaymentSubmission } from "@/types";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

interface SubmissionDetailModalProps {
  submission: PaymentSubmission | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
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

  if (!submission) return null;

  async function handleConfirm() {
    setLoading(true);
    try { await onConfirm(submission!.id); onClose(); }
    finally { setLoading(false); }
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setLoading(true);
    try { await onReject(submission!.id, reason); onClose(); }
    finally { setLoading(false); setReason(""); setRejecting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Payment Submission
            <PaymentStatusBadge status={submission.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Customer & amount info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Customer</p>
              <p className="font-semibold">{submission.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Amount</p>
              <p className="font-mono font-bold text-emerald-600">{naira(submission.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Periods</p>
              <p className="font-semibold">{submission.periodsCount} × {submission.frequency}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Submitted</p>
              <p className="text-sm">
                {(submission.submittedAt as unknown as { toDate: () => Date })?.toDate?.()?.toLocaleString() ?? "—"}
              </p>
            </div>
          </div>

          {/* Proof image */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Payment Proof</p>
            <a href={submission.proofImageUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={submission.proofImageUrl}
                alt="Payment proof"
                className="w-full max-h-72 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:opacity-90 transition-opacity cursor-zoom-in"
              />
            </a>
            <p className="text-xs text-slate-400 mt-1">Click to open full size</p>
          </div>

          {/* Selected periods */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
              Selected Periods ({submission.periods.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {submission.periods.map((p) => (
                <span key={p} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md font-mono">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {submission.note && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer Note</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 italic">&quot;{submission.note}&quot;</p>
            </div>
          )}

          {submission.rejectionReason && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-500 font-medium uppercase tracking-wide mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700 dark:text-red-300">{submission.rejectionReason}</p>
            </div>
          )}

          <Separator />

          {/* Actions */}
          {submission.status === "pending" && (
            <div className="space-y-3">
              {rejecting ? (
                <div className="space-y-2">
                  <Label htmlFor="reason">Rejection reason (required)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Explain why this payment cannot be confirmed..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={!reason.trim() || loading}
                      className="flex-1"
                    >
                      {loading ? "Rejecting…" : "Confirm Rejection"}
                    </Button>
                    <Button variant="outline" onClick={() => { setRejecting(false); setReason(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {loading ? "Confirming…" : "✓ Confirm Payment"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejecting(true)}
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
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
