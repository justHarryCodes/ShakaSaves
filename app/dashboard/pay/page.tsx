"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle2, Clock, CreditCard, X, Copy, AlertTriangle } from "lucide-react";
import type { SavingsCard } from "@/types";
import { cn } from "@/lib/utils";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

interface BankDetails { bankName: string; accountNumber: string; accountName: string; }

// ── 20-minute countdown modal ─────────────────────────────────────
function PaymentModal({
  open,
  total,
  bankDetails,
  onPaid,
  onCancel,
}: {
  open: boolean;
  total: number;
  bankDetails: BankDetails | null;
  onPaid: () => void;
  onCancel: () => void;
}) {
  const DURATION = 20 * 60; // 20 minutes in seconds
  const [secondsLeft, setSecondsLeft] = useState(DURATION);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) { setSecondsLeft(DURATION); return; }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(intervalRef.current!); onCancel(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [open, onCancel]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = (secondsLeft / DURATION) * 100;
  const urgent = secondsLeft < 120; // last 2 minutes

  if (!open) return null;

  async function handlePaid() {
    setSubmitting(true);
    try { await onPaid(); } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0D0D0D] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
        {/* Timer bar */}
        <div className="h-1 bg-white/[0.06]">
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${pct}%`,
              background: urgent ? "#EF4444" : "linear-gradient(90deg,#D4AF37,#B8962E)",
            }}
          />
        </div>

        <div className="p-6 space-y-5">
          {/* Timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className={urgent ? "text-red-400" : "text-zinc-400"} />
              <span className={cn("text-sm font-medium", urgent ? "text-red-400" : "text-zinc-400")}>
                Session expires in
              </span>
            </div>
            <span className={cn(
              "font-mono text-xl font-bold tabular-nums",
              urgent ? "text-red-400" : "text-white"
            )}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          </div>

          {/* Amount */}
          <div className="rounded-xl border border-gold-500/20 p-4 text-center"
            style={{ background: "rgba(212,175,55,0.05)" }}>
            <p className="text-xs text-zinc-500 mb-1">Transfer exactly</p>
            <p className="text-3xl font-bold text-gold-400">{naira(total)}</p>
          </div>

          {/* Bank details */}
          {bankDetails && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
              <p className="text-xs text-zinc-600 uppercase tracking-wide">{bankDetails.bankName}</p>
              <div className="flex items-center justify-between">
                <p className="font-mono text-xl font-bold text-white tracking-widest">{bankDetails.accountNumber}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(bankDetails.accountNumber); toast.success("Copied!"); }}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <Copy size={14} />
                </button>
              </div>
              <p className="text-sm text-zinc-400">{bankDetails.accountName}</p>
            </div>
          )}

          {urgent && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertTriangle size={13} /> Time is almost up — confirm quickly!
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="h-11 rounded-xl border-white/10 text-zinc-400 hover:text-white"
            >
              <X size={14} className="mr-1.5" /> Cancel
            </Button>
            <Button
              onClick={handlePaid}
              disabled={submitting}
              className="h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold disabled:opacity-50"
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              {submitting ? "Submitting…" : "I have paid"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function PayPage() {
  const { idToken } = useAuth();

  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [cards, setCards] = useState<SavingsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Selected cards + custom amounts
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const [settingsRes, cardsRes] = await Promise.all([
        fetch("/api/v1/settings", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/v1/cards", { headers: { Authorization: `Bearer ${idToken}` } }),
      ]);
      const [settingsJson, cardsJson] = await Promise.all([settingsRes.json(), cardsRes.json()]);
      if (settingsJson.success) setBankDetails(settingsJson.data.settings);
      if (cardsJson.success) setCards(cardsJson.data.cards);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { load(); }, [load]);

  function toggleCard(cardId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) { next.delete(cardId); } else { next.add(cardId); }
      return next;
    });
  }

  const selectedCards = cards.filter((c) => selected.has(c.id));
  const total = selectedCards.reduce((s, c) => {
    const v = Number(amounts[c.id] ?? 0);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);

  const canProceed = selected.size > 0 && total > 0 && selectedCards.every((c) => Number(amounts[c.id] ?? 0) > 0);

  async function handleSubmit() {
    if (!idToken || !canProceed) return;

    const cardAllocations = selectedCards.map((c) => ({
      cardId: c.id,
      amount: Number(amounts[c.id]),
    }));

    const res = await fetch("/api/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ cardAllocations, note: note || undefined }),
    });

    const json = await res.json();
    if (json.success) {
      setModalOpen(false);
      setSubmitted(true);
      toast.success("Payment recorded — waiting for admin approval.");
    } else {
      toast.error(json.error?.message ?? "Submission failed");
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Payment submitted!</h2>
        <p className="text-sm text-zinc-500">Admin will review and mark your cards once confirmed.</p>
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => { setSubmitted(false); setSelected(new Set()); setAmounts({}); setNote(""); }}
            className="h-9 rounded-xl border-white/10 text-zinc-300">
            Pay again
          </Button>
          <a href="/dashboard/payments">
            <Button className="h-9 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold">View history</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-bold text-white">Make a Payment</h2>

      {/* Step 1: Select cards */}
      <section className="space-y-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">1 — Select cards to contribute to</p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
            <p className="text-sm text-zinc-500">You have no savings cards yet.</p>
            <a href="/dashboard/cards" className="text-xs text-gold-400 hover:text-gold-300 mt-1 inline-block">
              Create a card first →
            </a>
          </div>
        ) : (
          cards.map((card) => {
            const isSelected = selected.has(card.id);
            const dailyAmt = card.dailyAmount ?? card.contributionAmount ?? 0;
            const days = card.tickedPeriods?.length ?? 0;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => toggleCard(card.id)}
                className={cn(
                  "w-full text-left rounded-xl border p-4 transition-all duration-150",
                  isSelected
                    ? "border-gold-500/40 bg-gold-500/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all",
                    isSelected ? "bg-gold-500 border-gold-500" : "border-white/20"
                  )}>
                    {isSelected && <CheckCircle2 size={13} className="text-black" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{card.cardName ?? "Savings Card"}</p>
                    <p className="text-xs text-zinc-500">{naira(dailyAmt)}/day · {days} days marked · bal {naira(card.currentBalance)}</p>
                  </div>
                  <CreditCard size={16} className={isSelected ? "text-gold-400" : "text-zinc-600"} />
                </div>

                {/* Amount input for this card */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
                    <label className="text-xs text-zinc-400 mb-1 block">Amount to contribute (₦)</label>
                    <Input
                      type="number"
                      min={1}
                      placeholder={`e.g. ${dailyAmt * 10}`}
                      value={amounts[card.id] ?? ""}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [card.id]: e.target.value }))}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-9 rounded-lg text-sm"
                    />
                    {amounts[card.id] && Number(amounts[card.id]) > 0 && dailyAmt > 0 && (
                      <p className="text-xs text-zinc-500 mt-1">
                        = {Math.floor(Number(amounts[card.id]) / dailyAmt)} days to be marked
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </section>

      {/* Step 2: Summary */}
      {selected.size > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-3">Summary</p>
          {selectedCards.map((c) => {
            const amt = Number(amounts[c.id] ?? 0);
            const daily = c.dailyAmount ?? c.contributionAmount ?? 0;
            const days = daily > 0 && amt > 0 ? Math.floor(amt / daily) : 0;
            return (
              <div key={c.id} className="flex justify-between text-sm">
                <span className="text-zinc-400">{c.cardName ?? "Card"}</span>
                <span className="text-white font-medium">
                  {amt > 0 ? naira(amt) : "—"}
                  {days > 0 && <span className="text-zinc-500 font-normal"> ({days}d)</span>}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between text-sm pt-2 border-t border-white/[0.06] font-semibold">
            <span className="text-zinc-300">Total</span>
            <span className="text-gold-400">{naira(total)}</span>
          </div>
        </section>
      )}

      {/* Optional note */}
      {selected.size > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400">Note for admin (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Any notes…"
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 text-sm px-3 py-2 resize-none focus:outline-none focus:border-gold-500/40"
          />
        </div>
      )}

      {/* Make Payment button */}
      <Button
        disabled={!canProceed}
        onClick={() => setModalOpen(true)}
        className="w-full h-12 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-bold text-base disabled:opacity-40"
      >
        Make Payment — {total > 0 ? naira(total) : "select cards above"}
      </Button>

      {/* Payment modal with 20-min timer */}
      <PaymentModal
        open={modalOpen}
        total={total}
        bankDetails={bankDetails}
        onPaid={handleSubmit}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
}
