"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Customer, PaymentSubmission, SavingsCard as SavingsCardType, Contribution, ContributionUpdateRequest } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(n);
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface DashboardData {
  customer: Customer;
  recentPayments: PaymentSubmission[];
  card: SavingsCardType | null;
  contributions: Contribution[];
}

const RING_SIZE = 88;
const RING_STROKE = 7;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

export default function CustomerDashboard() {
  const { idToken, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [contribStatus, setContribStatus] = useState<{
    pending: ContributionUpdateRequest | null;
    canRequest: boolean;
    currentAmount: number;
  } | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [newRateAmount, setNewRateAmount] = useState("");
  const [rateSubmitting, setRateSubmitting] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    Promise.all([
      fetch("/api/v1/dashboard/me", { headers: { Authorization: `Bearer ${idToken}` } }),
      fetch("/api/v1/customers/me/contribution-update", { headers: { Authorization: `Bearer ${idToken}` } }),
    ])
      .then(([dashRes, contribRes]) => Promise.all([dashRes.json(), contribRes.json()]))
      .then(([dashJson, contribJson]) => {
        if (dashJson.success) setData(dashJson.data);
        if (contribJson.success) setContribStatus(contribJson.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [idToken]);

  async function handleSubmitRate() {
    if (!idToken) return;
    const amount = Number(newRateAmount);
    if (!amount || amount <= 0 || amount === (contribStatus?.currentAmount ?? 0)) {
      toast.error("Enter a valid new amount different from your current rate");
      return;
    }
    setRateSubmitting(true);
    try {
      const res = await fetch("/api/v1/customers/me/contribution-update", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestedAmount: amount }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Rate update request submitted. Admin will review it.");
        setRateModalOpen(false);
        setNewRateAmount("");
        fetch("/api/v1/customers/me/contribution-update", { headers: { Authorization: `Bearer ${idToken}` } })
          .then((r) => r.json())
          .then((j) => { if (j.success) setContribStatus(j.data); })
          .catch(() => {});
      } else {
        toast.error(json.error?.message ?? "Failed to submit request");
      }
    } finally {
      setRateSubmitting(false);
    }
  }

  const now = new Date();
  const monthSaved = (data?.contributions ?? [])
    .filter((c) => {
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return (c.period ?? "").startsWith(prefix);
    })
    .reduce((s, c) => s + c.amount, 0);

  const pct = data?.customer?.monthlyTarget
    ? Math.min(Math.round((monthSaved / data.customer.monthlyTarget) * 100), 100)
    : 0;

  const ringOffset = RING_CIRC - (pct / 100) * RING_CIRC;
  const firstName = data?.customer?.fullName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";
  const dateStr = now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* Greeting */}
      <div>
        <p className="text-[11px] font-mono text-zinc-600 uppercase tracking-[0.15em]">{dateStr}</p>
        {loading ? (
          <Skeleton className="h-7 w-52 bg-white/[0.04] mt-1.5" />
        ) : (
          <h1 className="text-2xl font-bold text-white mt-1">
            {greet()}{firstName ? `, ${firstName}` : ""}
          </h1>
        )}
      </div>

      {/* ── Hero Balance ── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-gold-500/20 p-6 md:p-8"
        style={{ background: "linear-gradient(135deg, #0D0D0D 0%, #13110A 50%, #0D0D0D 100%)" }}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 80% at 95% 5%, rgba(212,175,55,0.09) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)" }}
        />

        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 mb-3">
              Confirmed Savings Balance
            </p>
            {loading ? (
              <Skeleton className="h-16 w-72 bg-white/[0.04]" />
            ) : (
              <p className="text-5xl md:text-6xl font-mono font-black text-white leading-none tracking-tight">
                {naira(data?.customer?.currentBalance ?? 0)}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-4">
              {loading ? (
                <Skeleton className="h-4 w-48 bg-white/[0.04]" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                  <span className="text-xs text-zinc-500 capitalize">
                    {naira(data?.customer?.contributionAmount ?? 0)}{" "}
                    <span className="text-zinc-600">/ {data?.customer?.contributionFrequency ?? "—"}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/pay">
              <Button
                className="h-10 px-5 rounded-xl font-bold text-sm text-black"
                style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
              >
                + Pay Now
              </Button>
            </Link>
            <Link href="/dashboard/withdraw">
              <Button
                variant="outline"
                className="h-10 px-5 rounded-xl font-medium text-sm text-zinc-300 border-white/10 bg-transparent hover:bg-white/[0.04] hover:text-white"
              >
                Withdraw
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Monthly Progress */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-5 flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="rotate-[-90deg]"
            >
              <circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                fill="none" stroke="#1A1A1A" strokeWidth={RING_STROKE}
              />
              <circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                fill="none"
                stroke={pct >= 100 ? "#10B981" : "#D4AF37"}
                strokeWidth={RING_STROKE}
                strokeDasharray={RING_CIRC}
                strokeDashoffset={loading ? RING_CIRC : ringOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.9s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[13px] font-mono font-bold"
                style={{ color: pct >= 100 ? "#10B981" : "#D4AF37" }}
              >
                {loading ? "—" : `${pct}%`}
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-600 uppercase tracking-widest">Monthly Target</p>
            {loading ? (
              <Skeleton className="h-5 w-24 bg-white/[0.04] mt-1.5" />
            ) : (
              <>
                <p className="text-sm font-mono font-bold text-white mt-1 truncate">{naira(monthSaved)}</p>
                <p className="text-[11px] text-zinc-600 font-mono">of {naira(data?.customer?.monthlyTarget ?? 0)}</p>
              </>
            )}
          </div>
        </div>

        {/* Contribution Plan */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-5 flex flex-col">
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-3">Contribution Plan</p>
          {loading ? (
            <Skeleton className="h-8 w-36 bg-white/[0.04]" />
          ) : (
            <>
              <p className="text-2xl font-mono font-black text-white">
                {naira(data?.customer?.contributionAmount ?? 0)}
              </p>
              <p className="text-xs text-zinc-500 mt-1 capitalize">
                per {data?.customer?.contributionFrequency ?? "—"}
              </p>
              {contribStatus?.pending && (
                <div className={cn(
                  "text-[10px] font-semibold px-2 py-1 rounded-full border w-fit mt-2",
                  contribStatus.pending.status === "pending"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : contribStatus.pending.status === "approved"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                )}>
                  {contribStatus.pending.status === "pending" && `${naira(contribStatus.pending.requestedAmount)}/day — pending`}
                  {contribStatus.pending.status === "approved" && "Rate updated ✓"}
                  {contribStatus.pending.status === "rejected" && "Update rejected"}
                </div>
              )}
            </>
          )}
          <div className="mt-auto pt-4 flex items-center justify-between">
            <Link href="/dashboard/pay" className="text-xs font-medium text-gold-500 hover:text-gold-400 transition-colors">
              Make a payment →
            </Link>
            {!loading && contribStatus?.canRequest && !contribStatus?.pending && (
              <button
                onClick={() => setRateModalOpen(true)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={11} /> Change rate
              </button>
            )}
          </div>
        </div>

        {/* Account Status */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-5 flex flex-col">
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-3">Account</p>
          {loading ? (
            <Skeleton className="h-8 w-28 bg-white/[0.04]" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-sm font-semibold text-white capitalize">
                  {data?.customer?.status ?? "Active"}
                </span>
              </div>
              <p className="text-xs text-zinc-600 font-mono mt-1 truncate">
                {data?.customer?.fullName ?? user?.email ?? ""}
              </p>
            </>
          )}
          <div className="mt-auto pt-4">
            <Link href="/dashboard/history" className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
              View history →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Savings Card */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] text-zinc-600 uppercase tracking-widest">Your Savings Card</p>
            <Link href="/dashboard/cards" className="text-xs font-medium text-gold-500 hover:text-gold-400 transition-colors">
              View card →
            </Link>
          </div>

          {loading ? (
            <div className="aspect-[1.586/1] rounded-xl bg-white/[0.03] animate-pulse" />
          ) : data?.card ? (
            <div className="aspect-[1.586/1] rounded-xl overflow-hidden border border-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.card.cardImageUrl}
                alt="Savings card"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[1.586/1] rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-gold-500/20 flex items-center justify-center"
                style={{ background: "rgba(212,175,55,0.07)" }}>
                <span className="text-gold-500 text-sm font-bold">SS</span>
              </div>
              <p className="text-xs text-zinc-600 text-center px-6">
                Your savings card is generated after your first confirmed payment
              </p>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] text-zinc-600 uppercase tracking-widest">Recent Payments</p>
            <Link href="/dashboard/payments" className="text-xs font-medium text-gold-500 hover:text-gold-400 transition-colors">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28 bg-white/[0.04]" />
                    <Skeleton className="h-3 w-16 bg-white/[0.04]" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full bg-white/[0.04]" />
                </div>
              ))}
            </div>
          ) : (data?.recentPayments ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-12 h-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-xl">
                💸
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-300">No payments yet</p>
                <p className="text-xs text-zinc-600 mt-0.5">Your payment history will appear here</p>
              </div>
              <Link href="/dashboard/pay">
                <Button
                  size="sm"
                  className="mt-1 h-8 px-4 rounded-xl text-xs font-bold text-black"
                  style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
                >
                  Make first payment
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {(data?.recentPayments ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3.5 group">
                  <div>
                    <p className="text-sm font-mono font-bold text-white group-hover:text-gold-400 transition-colors">
                      {naira(p.totalAmount ?? p.amount ?? 0)}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {p.cardAllocations ? p.cardAllocations.map((a) => a.cardName).join(", ") : `${p.periodsCount ?? 0} period${(p.periodsCount ?? 0) !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <PaymentStatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rate change modal */}
      <Dialog open={rateModalOpen} onOpenChange={(open) => { setRateModalOpen(open); if (!open) setNewRateAmount(""); }}>
        <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <RefreshCw size={15} className="text-gold-400" />
              Request rate change
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Current daily rate</p>
              <p className="text-xl font-bold text-white mt-0.5 font-mono">
                {naira(contribStatus?.currentAmount ?? 0)}<span className="text-xs text-zinc-500 font-normal">/day</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">New daily amount (₦)</label>
              <Input
                type="number"
                placeholder="Enter new amount"
                min={1}
                value={newRateAmount}
                onChange={(e) => setNewRateAmount(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl"
              />
            </div>
            <p className="text-[11px] text-zinc-600">
              Rate changes can be requested from the 25th of each month.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => { setRateModalOpen(false); setNewRateAmount(""); }}
                className="h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRate}
                disabled={rateSubmitting || !newRateAmount || Number(newRateAmount) <= 0 || Number(newRateAmount) === (contribStatus?.currentAmount ?? 0)}
                className="h-10 rounded-xl font-semibold text-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
              >
                {rateSubmitting ? "Sending…" : "Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
