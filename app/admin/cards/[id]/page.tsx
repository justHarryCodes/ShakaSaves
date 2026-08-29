"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import type { SavingsCard, SavingsPlan, Customer } from "@/types";
import { cn } from "@/lib/utils";
import { classifyPeriods } from "@/lib/utils/classify-periods";
import { computeWithdrawable } from "@/lib/utils/card-withdrawable";
import { classifyBatches, lastWithdrawalFor, formatK, computeMonthlyTotals, type PaymentBatch, type WithdrawalBatch } from "@/lib/utils/classify-batches";
import { fmtDate, tsToMs } from "@/lib/utils/fmt-date";
import { SavingsMonthGrid } from "@/components/shared/SavingsMonthGrid";

function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];


export default function AdminCardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { idToken } = useAuth();

  const [card, setCard] = useState<SavingsCard | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plan, setPlan] = useState<SavingsPlan | null>(null);
  const [paymentBatches, setPaymentBatches] = useState<PaymentBatch[]>([]);
  const [withdrawalBatches, setWithdrawalBatches] = useState<WithdrawalBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentIndex = now.getFullYear() * 12 + now.getMonth();
  const [centerIndex, setCenterIndex] = useState(currentIndex);

  const fetchCard = useCallback(async () => {
    if (!idToken || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/cards/${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setCard(json.data.card);
        setCustomer(json.data.customer ?? null);
        setPlan(json.data.plan ?? null);
        setPaymentBatches(json.data.paymentBatches ?? []);
        setWithdrawalBatches(json.data.withdrawalBatches ?? []);
        // Migrated cards: start at January 2026 so full history is visible from the first month
        if (json.data.card.migrated) {
          setCenterIndex(2026 * 12 + 0);
        } else {
          const periods: string[] = json.data.card.tickedPeriods ?? [];
          if (periods.length > 0) {
            const last = [...periods].sort().at(-1)!;
            setCenterIndex(parseInt(last.slice(0, 4)) * 12 + parseInt(last.slice(5, 7)) - 1);
          }
        }
      } else {
        router.push("/admin/cards");
      }
    } finally {
      setLoading(false);
    }
  }, [idToken, id, router]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 rounded-xl bg-white/[0.04]" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
        </div>
        <Skeleton className="h-64 rounded-xl bg-white/[0.04]" />
      </div>
    );
  }

  if (!card) return null;

  const dailyAmt = card.dailyAmount ?? 0;
  const withdrawnAmount = card.migrationAmountWtd ?? 0;
  // FoodBank cards have no admin commission; all other categories (Regular, Project 1M) use 1/month
  const hasCommission = card.category !== "FoodBank";
  const { withdrawnSet, commissionSet, availableSet, commissionDays, withdrawnDays } =
    classifyPeriods(card.tickedPeriods ?? [], dailyAmt, withdrawnAmount, hasCommission);
  const totalDays = card.tickedPeriods?.length ?? 0;

  // --- Commission & withdrawable — shared with the eligibility/request APIs so this
  // tile can never drift from what a withdrawal request will actually be allowed. ---
  const { withdrawable: withdrawableBalance, commissionHeld } = computeWithdrawable(card);
  // withdrawn amount (cumulative, both migrated history and new withdrawals)
  const withdrawn = card.migrationAmountWtd ?? 0;

  // --- Payment batches — alternating colors per confirmed payment. Migrated cards'
  // pre-migration history has no matching contribution doc, so it stays plain green. ---
  const { batchColorByDay, lastPayment } = classifyBatches(paymentBatches);
  const lastWithdrawal = lastWithdrawalFor(withdrawalBatches);
  const monthlyTotals = computeMonthlyTotals(paymentBatches, availableSet, dailyAmt);
  // Gross total saved = all ticked days × daily rate
  // For migrated cards this equals migrationTotalSavings + migrationAdminCommission (verified)
  // For new cards it grows as payments are confirmed
  const totalSavings = totalDays * dailyAmt;
  const displayYear = Math.floor(centerIndex / 12);
  const displayMonth = ((centerIndex % 12) + 12) % 12;

  return (
    <div className="space-y-5 pb-8">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin/cards")}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-white truncate">{card.cardName ?? "Savings Card"}</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-gold-500/10 text-gold-400 border-gold-500/20">
              {card.category ?? "General"}
            </span>
            {card.migrated && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                migrated
              </span>
            )}
          </div>
          {customer && (
            <p className="text-xs text-zinc-500 mt-0.5">{customer.fullName}</p>
          )}
        </div>
      </div>

      {/* Info tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Card ID",     value: card.id?.slice(-8).toUpperCase() ?? "—" },
          { label: "Customer ID", value: card.customerId?.slice(-8).toUpperCase() ?? "—" },
          { label: "Daily Rate",  value: naira(dailyAmt) },
          { label: "Days Marked", value: `${totalDays}d` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] p-3" style={{ background: "#0D0D0D" }}>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wide">{label}</div>
            <div className="text-sm font-mono font-semibold text-white mt-0.5 truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Financial tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Savings",      value: naira(totalSavings),                          color: "text-zinc-300" },
          { label: "Withdrawn",          value: withdrawn > 0 ? naira(withdrawn) : "₦0.00",   color: "text-amber-400" },
          { label: "Commission (held)",  value: `${commissionDays}d · ${naira(commissionHeld)}`, color: "text-yellow-400" },
          { label: "Withdrawable",       value: naira(withdrawableBalance),                    color: "text-emerald-400" },
          ...(lastPayment ? [{ label: "Last Payment", value: `${formatK(lastPayment.amount)} LM · ${fmtDate(lastPayment.confirmedAt)}`, color: "text-emerald-400" }] : []),
          ...(lastWithdrawal ? [{ label: "Last Withdrawal", value: `${formatK(lastWithdrawal.amount)} LW · ${fmtDate(lastWithdrawal.paidAt)}`, color: "text-red-400" }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] p-3" style={{ background: "#0D0D0D" }}>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wide">{label}</div>
            <div className={cn("text-base font-mono font-bold mt-0.5", color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Plan info */}
      {plan && (
        <div className="rounded-xl border border-white/[0.06] p-3 space-y-1" style={{ background: "#0D0D0D" }}>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Savings Plan</p>
          <p className="text-sm font-bold text-white">{plan.name}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {plan.lockDays && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Lock: {plan.lockDays} days
              </span>
            )}
            {plan.targetAmount && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Target: {naira(plan.targetAmount)}
              </span>
            )}
            {plan.bankAccount && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.08]">
                {plan.bankAccount.bankName} · {plan.bankAccount.accountNumber}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Customer details */}
      {customer && (
        <div className="rounded-xl border border-white/[0.06] p-3 space-y-1.5" style={{ background: "#0D0D0D" }}>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Customer</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">
            <div><span className="text-zinc-600">Name:</span> <span className="text-zinc-300">{customer.fullName}</span></div>
            {customer.email && <div><span className="text-zinc-600">Email:</span> <span className="text-zinc-300">{customer.email}</span></div>}
            {customer.phone && <div><span className="text-zinc-600">Phone:</span> <span className="text-zinc-300">{customer.phone}</span></div>}
            <div><span className="text-zinc-600">Created:</span> <span className="text-zinc-300">{fmtDate(card.createdAt)}</span></div>
          </div>
        </div>
      )}

      {/* Calendar */}
      {totalDays > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              Withdrawn: {withdrawnDays}d
            </span>
            <span className="px-2 py-0.5 rounded-full border border-yellow-500/30 text-yellow-400" style={{ background: "rgba(212,175,55,0.08)" }}>
              Commission: {commissionDays}d
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Available: {totalDays - withdrawnDays - commissionDays}d
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCenterIndex((i) => i - 1)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.05]"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs text-zinc-300 font-medium">{MONTH_NAMES[displayMonth]} {displayYear}</span>
            <button
              onClick={() => setCenterIndex((i) => i + 1)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.05]"
            >
              <ChevronRight size={13} />
            </button>
            {centerIndex !== currentIndex && (
              <button
                onClick={() => setCenterIndex(currentIndex)}
                className="text-[11px] font-medium text-zinc-600 hover:text-white px-2 h-6 rounded-lg hover:bg-white/[0.05] transition-colors ml-1"
              >
                Today
              </button>
            )}
          </div>

          <SavingsMonthGrid
            year={displayYear}
            month={displayMonth}
            withdrawnSet={withdrawnSet}
            commissionSet={commissionSet}
            availableSet={availableSet}
            batchColorByDay={batchColorByDay}
            dailyAmt={dailyAmt}
            naira={naira}
            monthlyTotal={monthlyTotals.get(`${displayYear}-${String(displayMonth + 1).padStart(2, "0")}`) ?? null}
          />

          <div className="flex flex-wrap gap-3">
            {[
              { color: "bg-emerald-500", label: "Saved" },
              ...(Array.from(batchColorByDay.values()).includes("b") ? [{ color: "bg-blue-500", label: "Next payment" }] : []),
              { color: "bg-red-500",     label: "Withdrawn" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
                {label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#D4AF37" }} />
              Admin commission 1/month
            </span>
          </div>
        </div>
      )}
      {totalDays === 0 && (
        <div className="text-xs text-zinc-600 italic">No periods marked yet</div>
      )}
    </div>
  );
}
