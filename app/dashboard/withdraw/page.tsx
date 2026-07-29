"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { WithdrawalStatusBadge } from "@/components/shared/WithdrawalStatusBadge";
import { toast } from "sonner";
import type { Withdrawal } from "@/types";

function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: unknown) {
  if (!v) return "—";
  const d = (v as { toDate?: () => Date })?.toDate?.() ?? new Date(v as string);
  return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

interface CardEligibility {
  id: string;
  cardName: string;
  category: string;
  currentBalance: number;
  dailyAmount: number;
  withdrawable: number;
  lockedReason: string | null;
}

export default function WithdrawPage() {
  const { idToken } = useAuth();
  const [eligibility, setEligibility] = useState<{ withdrawableBalance: number; cards: CardEligibility[] } | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const [eligRes, wdRes] = await Promise.all([
        fetch("/api/v1/withdrawals/eligibility", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/v1/withdrawals/me", { headers: { Authorization: `Bearer ${idToken}` } }),
      ]);
      const [eligJson, wdJson] = await Promise.all([eligRes.json(), wdRes.json()]);
      if (eligJson.success) setEligibility(eligJson.data);
      if (wdJson.success) setWithdrawals(wdJson.data.withdrawals);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { toast.error("Enter a valid amount"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/withdrawals", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRequested: amountNum,
          note: accountNumber.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Withdrawal request submitted!");
        setAmount("");
        setAccountNumber("");
        await loadData();
      } else {
        toast.error(json.error?.message ?? "Request failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasPending = withdrawals.some((w) => w.status === "pending");
  const withdrawable = eligibility?.withdrawableBalance ?? 0;

  return (
    <div className="space-y-5 pb-8 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Withdraw Savings</h2>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl bg-white/[0.04]" />
          <Skeleton className="h-48 rounded-2xl bg-white/[0.04]" />
        </div>
      ) : (
        <>
          {/* Withdrawable balance */}
          <div
            className="rounded-2xl border border-white/[0.06] p-5 space-y-1"
            style={{ background: "#0D0D0D" }}
          >
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Withdrawable Balance</p>
            <p className="text-3xl font-mono font-bold" style={{ color: "#D4AF37" }}>
              {naira(withdrawable)}
            </p>

            {/* Per-card breakdown if multiple cards or any locked */}
            {(eligibility?.cards?.length ?? 0) > 1 || eligibility?.cards?.some((c) => c.lockedReason) ? (
              <div className="mt-3 space-y-1.5">
                {eligibility?.cards?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 truncate max-w-[60%]">{c.cardName}</span>
                    {c.lockedReason ? (
                      <span className="text-amber-400 text-right truncate max-w-[40%]">{c.lockedReason}</span>
                    ) : (
                      <span className="font-mono text-emerald-400">{naira(c.withdrawable)}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Form or pending notice */}
          {hasPending ? (
            <div
              className="rounded-2xl border border-amber-500/20 p-5"
              style={{ background: "#0D0D0D" }}
            >
              <p className="text-amber-400 text-sm font-medium">
                You have a pending withdrawal request. Please wait for it to be processed before submitting a new one.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl border border-white/[0.06] p-5 space-y-4"
              style={{ background: "#0D0D0D" }}
            >
              <p className="text-sm font-semibold text-white">Request a Withdrawal</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500 uppercase tracking-wide">Amount (₦)</label>
                  <input
                    type="number"
                    min={1}
                    max={withdrawable}
                    step="any"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white font-mono text-lg placeholder-zinc-700 focus:outline-none focus:ring-1 focus:border-[#D4AF37]"
                    style={{ "--tw-ring-color": "#D4AF37" } as React.CSSProperties}
                  />
                  <p className="text-xs text-zinc-600">Max: {naira(withdrawable)}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500 uppercase tracking-wide">Account number</label>
                  <input
                    type="text"
                    placeholder="Enter account number to receive funds"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none focus:ring-1 focus:border-[#D4AF37]"
                    style={{ "--tw-ring-color": "#D4AF37" } as React.CSSProperties}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !amount || withdrawable <= 0}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40"
                  style={{ background: "#D4AF37", color: "#0A0A0A" }}
                >
                  {submitting ? "Submitting…" : "Request Withdrawal"}
                </button>
              </form>
            </div>
          )}

          {/* Withdrawal history */}
          {withdrawals.length > 0 && (
            <div
              className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: "#0D0D0D" }}
            >
              <p className="text-xs text-zinc-600 uppercase tracking-wide px-5 pt-4 pb-2">Withdrawal History</p>
              <div className="divide-y divide-white/[0.04]">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-mono font-bold text-white text-sm">{naira(w.amountRequested)}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">{fmtDate(w.requestedAt)}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <WithdrawalStatusBadge status={w.status} />
                      {w.rejectionReason && (
                        <p className="text-xs text-red-400">{w.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
