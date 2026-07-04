"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, CreditCard, Calendar, TrendingUp,
  Clock, CheckCircle2, XCircle, Upload, ImageIcon, Copy, AlertTriangle,
} from "lucide-react";
import type { SavingsCard, CardRequest, BankAccount } from "@/types";
import { cn } from "@/lib/utils";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

// ── Card tile ─────────────────────────────────────────────────────────
function CardTile({ card }: { card: SavingsCard }) {
  const days = card.tickedPeriods?.length ?? 0;
  const dailyAmt = card.dailyAmount ?? card.contributionAmount ?? 0;
  const estimatedTotal = dailyAmt * 365;
  const pct = estimatedTotal > 0 ? Math.min(100, (card.currentBalance / estimatedTotal) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0D0D0D] p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{card.cardName ?? "Savings Card"}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{naira(dailyAmt)}/day</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-gold-500/20"
          style={{ background: "rgba(212,175,55,0.08)" }}>
          <CreditCard size={18} className="text-gold-400" />
        </div>
      </div>
      <div>
        <p className="text-xs text-zinc-600 uppercase tracking-wide">Balance</p>
        <p className="text-2xl font-bold text-white mt-0.5">{naira(card.currentBalance)}</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Calendar size={11} /> {days} days marked</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #D4AF37, #B8962E)" }}
          />
        </div>
      </div>
      {days > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {(card.tickedPeriods ?? []).slice(-6).map((p) => (
            <span key={p} className="text-[10px] font-mono bg-gold-500/10 text-gold-400 border border-gold-500/20 px-1.5 py-0.5 rounded">
              {p}
            </span>
          ))}
          {days > 6 && <span className="text-[10px] text-zinc-600 self-center">+{days - 6} more</span>}
        </div>
      )}
    </div>
  );
}

// ── Pending request banner ────────────────────────────────────────────
function RequestStatusBanner({ request }: { request: CardRequest }) {
  const statusMap = {
    pending: {
      icon: <Clock size={16} className="text-amber-400" />,
      label: "Under review",
      color: "border-amber-500/20 bg-amber-500/[0.06]",
      text: "text-amber-400",
    },
    approved: {
      icon: <CheckCircle2 size={16} className="text-emerald-400" />,
      label: "Approved",
      color: "border-emerald-500/20 bg-emerald-500/[0.06]",
      text: "text-emerald-400",
    },
    rejected: {
      icon: <XCircle size={16} className="text-red-400" />,
      label: "Not approved",
      color: "border-red-500/20 bg-red-500/[0.06]",
      text: "text-red-400",
    },
  };

  const s = statusMap[request.status];

  return (
    <div className={cn("rounded-xl border p-4 space-y-1", s.color)}>
      <div className="flex items-center gap-2">
        {s.icon}
        <span className={cn("text-sm font-semibold", s.text)}>
          Card request: &quot;{request.cardName}&quot; — {s.label}
        </span>
      </div>
      <p className="text-xs text-zinc-500 pl-6">
        {naira(request.dailyAmount)}/day · First payment {naira(request.firstPaymentAmount)} ({request.daysToMark} day{request.daysToMark !== 1 ? "s" : ""})
      </p>
      {request.status === "rejected" && request.rejectionReason && (
        <p className="text-xs text-red-400 pl-6">Reason: {request.rejectionReason}</p>
      )}
    </div>
  );
}

// ── Request card modal — 3 steps ──────────────────────────────────────
// Step 1: card details  →  Step 2: pay (bank + countdown)  →  Step 3: upload proof + submit

const TIMER_DURATION = 20 * 60; // 20 minutes

function RequestCardModal({
  open,
  onClose,
  onRequested,
}: {
  open: boolean;
  onClose: () => void;
  onRequested: () => void;
}) {
  const { idToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cardName, setCardName] = useState("");
  const [dailyAmount, setDailyAmount] = useState("");
  const [firstPayment, setFirstPayment] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_DURATION);
  const [loading, setLoading] = useState(false);

  const daily = Number(dailyAmount);
  const payment = Number(firstPayment);
  const daysPreview = daily > 0 && payment >= daily ? Math.floor(payment / daily) : 0;
  const urgent = secondsLeft < 120;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timerPct = (secondsLeft / TIMER_DURATION) * 100;

  // Fetch bank accounts when entering step 2
  useEffect(() => {
    if (step !== 2 || !idToken) return;
    fetch("/api/v1/settings", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.settings?.accounts) setBankAccounts(j.data.settings.accounts);
      })
      .catch(() => {});
  }, [step, idToken]);

  // Countdown timer on step 2
  useEffect(() => {
    if (step !== 2) { clearInterval(intervalRef.current!); return; }
    setSecondsLeft(TIMER_DURATION);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          // timer expired — go back to step 1
          setStep(1);
          toast.error("Payment session expired. Please start again.");
          return TIMER_DURATION;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [step]);

  function reset() {
    setCardName("");
    setDailyAmount("");
    setFirstPayment("");
    setProofFile(null);
    setStep(1);
    setSecondsLeft(TIMER_DURATION);
    clearInterval(intervalRef.current!);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleStep1Continue() {
    if (!cardName.trim()) { toast.error("Please enter a card name"); return; }
    if (daily <= 0) { toast.error("Daily amount must be greater than 0"); return; }
    if (payment < daily) { toast.error(`First payment must be at least ${naira(daily)}`); return; }
    setStep(2);
  }

  function handlePaid() {
    clearInterval(intervalRef.current!);
    setStep(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken || !proofFile) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("cardName", cardName.trim());
      fd.append("dailyAmount", String(daily));
      fd.append("firstPaymentAmount", String(payment));
      fd.append("proof", proofFile);

      const res = await fetch("/api/v1/cards/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: fd,
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Card request submitted! Admin will review shortly.");
        reset();
        onRequested();
        onClose();
      } else {
        toast.error(json.error?.message ?? "Failed to submit request");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ["Details", "Pay", "Proof"];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-sm p-0 overflow-hidden">

        {/* Step 2 timer bar */}
        {step === 2 && (
          <div className="h-1 bg-white/[0.06]">
            <div
              className="h-full transition-all duration-1000"
              style={{
                width: `${timerPct}%`,
                background: urgent ? "#EF4444" : "linear-gradient(90deg,#D4AF37,#B8962E)",
              }}
            />
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Header */}
          <div>
            <DialogHeader>
              <DialogTitle className="text-white">
                {step === 1 && "Request a savings card"}
                {step === 2 && "Make your first payment"}
                {step === 3 && "Upload payment proof"}
              </DialogTitle>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-3">
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      done ? "bg-gold-500/20 text-gold-500" :
                      active ? "bg-gold-500 text-black" :
                      "bg-white/10 text-zinc-500"
                    )}>
                      {done ? <CheckCircle2 size={13} /> : n}
                    </div>
                    <span className={cn("text-[11px] font-medium", active ? "text-zinc-300" : "text-zinc-600")}>{label}</span>
                    {i < stepLabels.length - 1 && (
                      <div className={cn("w-6 h-px", done ? "bg-gold-500/40" : "bg-white/10")} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── STEP 1: Card details ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Card name</Label>
                <Input
                  placeholder="e.g. House fund, School fees…"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  maxLength={60}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Daily contribution (₦)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  min={1}
                  value={dailyAmount}
                  onChange={(e) => setDailyAmount(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl"
                />
                {daily > 0 && (
                  <p className="text-[11px] text-zinc-600">≈ {naira(daily * 30)}/month · {naira(daily * 365)}/year</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">First commitment payment (₦)</Label>
                <Input
                  type="number"
                  placeholder={daily > 0 ? `Min. ${naira(daily)}` : "Enter daily amount first"}
                  min={daily > 0 ? daily : 1}
                  value={firstPayment}
                  onChange={(e) => setFirstPayment(e.target.value)}
                  disabled={daily <= 0}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl disabled:opacity-40"
                />
                {daysPreview > 0 && (
                  <p className="text-[11px] text-emerald-400">
                    → {daysPreview} day{daysPreview !== 1 ? "s" : ""} will be marked on approval
                  </p>
                )}
              </div>

              <Button
                type="button"
                disabled={!cardName.trim() || daily <= 0 || daysPreview < 1}
                onClick={handleStep1Continue}
                className="w-full h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold disabled:opacity-50"
              >
                Continue to payment →
              </Button>
            </div>
          )}

          {/* ── STEP 2: Bank details + countdown ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Timer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={15} className={urgent ? "text-red-400" : "text-zinc-400"} />
                  <span className={cn("text-xs font-medium", urgent ? "text-red-400" : "text-zinc-400")}>
                    Session expires in
                  </span>
                </div>
                <span className={cn("font-mono text-lg font-bold tabular-nums", urgent ? "text-red-400" : "text-white")}>
                  {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                </span>
              </div>

              {/* Amount */}
              <div className="rounded-xl border border-gold-500/20 p-4 text-center"
                style={{ background: "rgba(212,175,55,0.05)" }}>
                <p className="text-xs text-zinc-500 mb-1">Transfer exactly</p>
                <p className="text-3xl font-bold text-gold-400">{naira(payment)}</p>
              </div>

              {/* Bank accounts */}
              {bankAccounts.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-600 uppercase tracking-wide">
                    {bankAccounts.length === 1 ? "Transfer to" : "Transfer to any one account"}
                  </p>
                  {bankAccounts.map((acct) => (
                    <div key={acct.id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{acct.bankName}</p>
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-lg font-bold text-white tracking-widest">{acct.accountNumber}</p>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(acct.accountNumber); toast.success("Copied!"); }}
                          className="text-zinc-500 hover:text-white transition-colors p-1"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <p className="text-sm text-zinc-400">{acct.accountName}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 animate-pulse h-20" />
              )}

              {urgent && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <AlertTriangle size={13} /> Time is almost up — confirm quickly!
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-11 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent"
                >
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={handlePaid}
                  className="h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
                >
                  <CheckCircle2 size={15} className="mr-1.5" /> I have paid
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Upload proof + submit ── */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-zinc-500">
                Upload a screenshot or receipt confirming your transfer of{" "}
                <span className="text-gold-400 font-semibold">{naira(payment)}</span>.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full h-28 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 transition-colors",
                  proofFile
                    ? "border-gold-500/40 bg-gold-500/[0.04]"
                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                )}
              >
                {proofFile ? (
                  <>
                    <ImageIcon size={22} className="text-gold-400" />
                    <span className="text-xs text-gold-400 max-w-[200px] truncate">{proofFile.name}</span>
                    <span className="text-[10px] text-zinc-600">Tap to change</span>
                  </>
                ) : (
                  <>
                    <Upload size={22} className="text-zinc-600" />
                    <span className="text-xs text-zinc-500">Tap to upload proof</span>
                    <span className="text-[10px] text-zinc-700">JPEG, PNG or WebP · max 5MB</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="h-11 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent"
                >
                  ← Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !proofFile}
                  className="h-11 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold disabled:opacity-50"
                >
                  {loading ? "Submitting…" : "Submit request"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────
export default function CardsPage() {
  const { idToken } = useAuth();
  const [cards, setCards] = useState<SavingsCard[]>([]);
  const [requests, setRequests] = useState<CardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);

  const fetchData = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const [cardsRes, reqRes] = await Promise.all([
        fetch("/api/v1/cards", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/v1/cards/request", { headers: { Authorization: `Bearer ${idToken}` } }),
      ]);
      const [cardsJson, reqJson] = await Promise.all([cardsRes.json(), reqRes.json()]);
      if (cardsJson.success) setCards(cardsJson.data.cards);
      if (reqJson.success) setRequests(reqJson.data.requests);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pendingRequest = requests.find((r) => r.status === "pending") ?? null;
  const latestNonApproved = requests.find((r) => r.status === "rejected") ?? null;
  const totalBalance = cards.reduce((s, c) => s + (c.currentBalance ?? 0), 0);
  const totalDays = cards.reduce((s, c) => s + (c.tickedPeriods?.length ?? 0), 0);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">My Savings Cards</h2>
          {!loading && cards.length > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {cards.length} card{cards.length !== 1 ? "s" : ""} · {totalDays} days marked · {naira(totalBalance)} total
            </p>
          )}
        </div>
        <Button
          onClick={() => setShowRequest(true)}
          disabled={!!pendingRequest}
          title={pendingRequest ? "You have a pending card request" : undefined}
          className="h-9 px-3 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm gap-1.5 disabled:opacity-50"
        >
          <Plus size={15} /> Request card
        </Button>
      </div>

      {/* Pending or rejected request status */}
      {pendingRequest && <RequestStatusBanner request={pendingRequest} />}
      {!pendingRequest && latestNonApproved && <RequestStatusBanner request={latestNonApproved} />}

      {/* Cards grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-2xl bg-white/[0.04]" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/[0.06] bg-white/[0.02]">
            <TrendingUp size={28} className="text-zinc-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">No savings cards yet</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              {pendingRequest
                ? "Your card request is being reviewed. You'll be notified once approved."
                : "Request a card to start tracking daily contributions towards your goal."}
            </p>
          </div>
          {!pendingRequest && (
            <Button
              onClick={() => setShowRequest(true)}
              className="h-9 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm gap-1.5"
            >
              <Plus size={14} /> Request your first card
            </Button>
          )}
        </div>
      ) : (
        <div className={cn("grid gap-4", cards.length > 1 ? "sm:grid-cols-2" : "")}>
          {cards.map((card) => <CardTile key={card.id} card={card} />)}
        </div>
      )}

      <RequestCardModal
        open={showRequest}
        onClose={() => setShowRequest(false)}
        onRequested={fetchData}
      />
    </div>
  );
}
