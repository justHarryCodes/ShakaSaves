"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, ArrowLeft, FileDown, CreditCard,
  Lock, Target, CheckCircle2, AlertTriangle,
} from "lucide-react";
import type { SavingsCard, SavingsPlan } from "@/types";
import { cn } from "@/lib/utils";
import { resolveEffectivePlan } from "@/lib/utils/plan-rules";
import { classifyPeriods } from "@/lib/utils/classify-periods";
import { tsToMs } from "@/lib/utils/fmt-date";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(_year: number, _month: number) { return 31; }


function MonthGrid({
  year, month, withdrawnSet, commissionSet, availableSet, dailyAmt,
}: {
  year: number; month: number;
  withdrawnSet: Set<string>; commissionSet: Set<string>; availableSet: Set<string>;
  dailyAmt: number;
}) {
  const monthStr = String(month + 1).padStart(2, "0");
  const dim = daysInMonth(year, month);
  const firstWeekday = new Date(year, month, 1).getDay();

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {MONTH_NAMES[month]} <span className="text-zinc-500 font-medium">{year}</span>
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <span key={i} className="text-[10px] text-zinc-600 font-medium text-center">{d}</span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: dim }, (_, i) => {
          const day = i + 1;
          const key = `${year}-${monthStr}-${String(day).padStart(2, "0")}`;
          const isWithdrawn  = withdrawnSet.has(key);
          const isCommission = commissionSet.has(key);
          const isAvailable  = availableSet.has(key);
          return (
            <div
              key={day}
              title={
                isWithdrawn  ? `${MONTH_NAMES[month]} ${day}: withdrawn` :
                isCommission ? `${MONTH_NAMES[month]} ${day}: admin commission` :
                isAvailable  ? `${MONTH_NAMES[month]} ${day}: ${naira(dailyAmt)}` : undefined
              }
              className={cn(
                "aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium transition-colors",
                isWithdrawn  ? "bg-red-500 text-white" :
                isAvailable  ? "bg-emerald-500 text-white" :
                               "text-zinc-600 hover:text-zinc-400"
              )}
              style={isCommission ? { background: "#D4AF37", color: "#000" } : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Withdrawal eligibility panel ───────────────────────────────────
function WithdrawalPanel({ card, plan, grossSaved }: { card: SavingsCard; plan: SavingsPlan | null; grossSaved: number }) {
  const effective = resolveEffectivePlan(card.category, plan);

  // Regular / unknown — always withdrawable
  if (!effective) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-400">Withdraw anytime</p>
        </div>
        <p className="text-xs text-zinc-500">Regular savings cards have no withdrawal restrictions.</p>
        <Button
          onClick={() => window.location.href = "/dashboard/withdraw"}
          className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm"
        >
          Request withdrawal
        </Button>
      </div>
    );
  }

  // Time-locked plan
  if (effective.lockDays) {
    const createdMs = tsToMs(card.createdAt) ?? Date.now();
    const daysHeld = Math.floor((Date.now() - createdMs) / 86_400_000);
    const daysLeft = Math.max(0, effective.lockDays - daysHeld);
    const unlocked = daysLeft === 0;
    const pct = Math.min(100, (daysHeld / effective.lockDays) * 100);
    const unlockDate = new Date(createdMs + effective.lockDays * 86_400_000).toLocaleDateString("en-NG", {
      day: "numeric", month: "long", year: "numeric",
    });

    return (
      <div className={cn(
        "rounded-2xl border p-4 space-y-3",
        unlocked ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.04]"
      )}>
        <div className="flex items-center gap-2">
          {unlocked
            ? <CheckCircle2 size={16} className="text-emerald-400" />
            : <Lock size={16} className="text-amber-400" />}
          <p className={cn("text-sm font-semibold", unlocked ? "text-emerald-400" : "text-amber-400")}>
            {unlocked ? "Lock period complete" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{daysHeld} of {effective.lockDays} days held</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", unlocked ? "bg-emerald-500" : "bg-amber-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!unlocked && (
            <p className="text-[11px] text-zinc-600">Unlocks on {unlockDate}</p>
          )}
        </div>

        {unlocked ? (
          <Button
            onClick={() => window.location.href = "/dashboard/withdraw"}
            className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm"
          >
            Request withdrawal
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/[0.06] rounded-xl px-3 py-2.5">
            <AlertTriangle size={13} />
            {effective.name} cards are locked for {effective.lockDays} days from creation.
          </div>
        )}
      </div>
    );
  }

  // Target amount plan — check against GROSS saved, not net balance.
  // A user who saved ₦1.2M and withdrew ₦300k has reached a ₦1M target.
  if (effective.targetAmount) {
    const balance = grossSaved;
    const reached = balance >= effective.targetAmount;
    const pct = Math.min(100, (balance / effective.targetAmount) * 100);

    return (
      <div className={cn(
        "rounded-2xl border p-4 space-y-3",
        reached ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-blue-500/20 bg-blue-500/[0.04]"
      )}>
        <div className="flex items-center gap-2">
          {reached
            ? <CheckCircle2 size={16} className="text-emerald-400" />
            : <Target size={16} className="text-blue-400" />}
          <p className={cn("text-sm font-semibold", reached ? "text-emerald-400" : "text-blue-400")}>
            {reached ? "Savings target reached!" : `${naira(effective.targetAmount - balance)} to go`}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{naira(grossSaved)} saved of {naira(effective.targetAmount)} target</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", reached ? "bg-emerald-500" : "bg-blue-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {reached ? (
          <Button
            onClick={() => window.location.href = "/dashboard/withdraw"}
            className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm"
          >
            Request withdrawal
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-blue-400/80 bg-blue-500/[0.06] rounded-xl px-3 py-2.5">
            <Target size={13} />
            {effective.name}: withdraw after saving {naira(effective.targetAmount)}.
          </div>
        )}
      </div>
    );
  }

  // Non-Regular category with no specific condition defined — block withdrawal
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lock size={16} className="text-amber-400" />
        <p className="text-sm font-semibold text-amber-400">Withdrawal restricted</p>
      </div>
      <p className="text-xs text-zinc-500">{effective.name} cards have withdrawal conditions. Contact support for details.</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────
export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { idToken } = useAuth();

  const [card, setCard] = useState<SavingsCard | null>(null);
  const [plan, setPlan] = useState<SavingsPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const now = new Date();
  const currentIndex = now.getFullYear() * 12 + now.getMonth();
  const [centerIndex, setCenterIndex] = useState(currentIndex);

  const fetchCard = useCallback(async () => {
    if (!idToken || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/card/${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setCard(json.data.card);
        setPlan(json.data.plan ?? null);
        // Migrated cards: start at January 2026 so the full history is visible from day one
        const isMigrated = !!json.data.card.migrated;
        if (isMigrated) {
          setCenterIndex(2026 * 12 + 0); // January 2026
        } else {
          const periods: string[] = json.data.card.tickedPeriods ?? [];
          if (periods.length > 0) {
            const last = [...periods].sort().at(-1)!;
            setCenterIndex(parseInt(last.slice(0, 4)) * 12 + parseInt(last.slice(5, 7)) - 1);
          }
        }
      } else {
        toast.error("Card not found");
        router.push("/dashboard/cards");
      }
    } finally {
      setLoading(false);
    }
  }, [idToken, id, router]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

  async function downloadExcel() {
    if (!card) return;
    setDownloading(true);
    try {
      const XLSX = await import("xlsx");
      const dailyAmt = card.dailyAmount ?? card.contributionAmount ?? 0;
      const markedSet = new Set(card.tickedPeriods ?? []);
      const cardLabel = card.cardName ?? "Savings Card";
      const year = Math.floor(centerIndex / 12);
      const aoa: (string | number)[][] = [];
      aoa.push(["Shakasave Daily Contribution Card"]);
      aoa.push([`Card: ${cardLabel}`, `Daily: ₦${dailyAmt.toLocaleString()}`, `Year: ${year}`]);
      aoa.push([]);
      aoa.push(["Month", "Amount (₦)", ...Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`)]);
      let grandTotal = 0;
      for (let m = 0; m < 12; m++) {
        const monthStr = String(m + 1).padStart(2, "0");
        const dayValues: (number | "")[] = Array(31).fill("");
        let monthTotal = 0;
        for (let d = 1; d <= 31; d++) {
          const dayStr = String(d).padStart(2, "0");
          if (markedSet.has(`${year}-${monthStr}-${dayStr}`)) {
            dayValues[d - 1] = dailyAmt;
            monthTotal += dailyAmt;
          }
        }
        grandTotal += monthTotal;
        aoa.push([MONTH_NAMES[m], monthTotal, ...dayValues]);
      }
      aoa.push([]);
      aoa.push(["GRAND TOTAL", grandTotal]);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 14 }, { wch: 14 }, ...Array(31).fill({ wch: 7 })];
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 32 } }];
      XLSX.utils.book_append_sheet(wb, ws, String(year));
      XLSX.writeFile(wb, `${cardLabel.replace(/\s+/g, "-")}-${year}.xlsx`);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 rounded-xl bg-white/[0.04]" />
        <Skeleton className="h-52 rounded-2xl bg-white/[0.04]" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
        </div>
      </div>
    );
  }

  if (!card) return null;

  const dailyAmt  = card.dailyAmount ?? card.contributionAmount ?? 0;
  // withdrawnAmount = cumulative cash paid out as withdrawal (set by mark-paid; API enriches
  // from paid withdrawal records so it's always accurate even for older withdrawals)
  const withdrawnAmount = card.migrationAmountWtd ?? 0;

  // FoodBank has no admin commission; Regular / Project 1M: 1 day per month
  const hasCommission = card.category !== "FoodBank";
  const { withdrawnSet, commissionSet, availableSet, commissionDays } =
    classifyPeriods(card.tickedPeriods ?? [], dailyAmt, withdrawnAmount, hasCommission);
  const totalDays     = card.tickedPeriods?.length ?? 0;
  const availableDays = availableSet.size;
  const withdrawnDays = withdrawnSet.size;

  // --- Commission & withdrawable ---
  // calendarCommission = 1 day per month rule across ALL ticked periods (0 for FoodBank)
  const calendarCommission = commissionDays * dailyAmt;
  // migrationCommission = historical commission already baked into currentBalance for migrated cards
  // (from records.ts, stored at import time); 0 for new cards
  const migrationCommission = card.migrated ? (card.migrationAdminCommission ?? 0) : 0;
  // additionalCommission = new months post-migration not yet accounted for in currentBalance
  // For new (non-migrated) cards this equals the full calendarCommission
  const additionalCommission = Math.max(0, calendarCommission - migrationCommission);
  // Total commission owed to admin (historical + new post-migration)
  const commissionHeld = migrationCommission + additionalCommission;
  // Withdrawable = currentBalance minus the portion not yet accounted for
  const withdrawableBalance = Math.max(0, card.currentBalance - additionalCommission);

  // Gross total cash ever deposited into this card:
  //   currentBalance = gross deposited − withdrawals paid
  //   so gross = currentBalance + withdrawnAmount
  // (More accurate than totalDays × dailyAmt which ignores rounding remainders)
  const grossDeposited = card.currentBalance + withdrawnAmount;

  const displayYear  = Math.floor(centerIndex / 12);
  const displayMonth = ((centerIndex % 12) + 12) % 12;

  return (
    <div className="space-y-5 pb-8">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/cards")}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-white truncate">{card.cardName ?? "Savings Card"}</h1>
            {card.migrated && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20">
                Migrated
              </span>
            )}
            {card.category && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
                {card.category}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{naira(dailyAmt)}/day · {totalDays} days marked</p>
        </div>
        <Button
          onClick={downloadExcel}
          disabled={downloading}
          size="sm"
          className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5 shrink-0 disabled:opacity-60"
        >
          <FileDown size={13} /> {downloading ? "Preparing…" : `Download ${displayYear}`}
        </Button>
      </div>

      {/* Stats — 4 tiles: gross deposited → withdrawn → commission → what's left */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total saved",   value: naira(grossDeposited),       color: "text-white" },
          { label: "Withdrawn",     value: naira(withdrawnAmount),       color: withdrawnAmount > 0 ? "text-red-400" : "text-zinc-500" },
          { label: "Commission",    value: naira(commissionHeld),        color: commissionHeld > 0 ? "text-yellow-400" : "text-zinc-500" },
          { label: "Withdrawable",  value: naira(withdrawableBalance),   color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">{label}</p>
            <p className={cn("text-sm font-bold", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Balance breakdown — reconciliation for ALL cards: gross → deductions → net */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-1">Breakdown</p>
        {([
          { label: "Total saved (gross)",      value: naira(grossDeposited),       color: "text-white",       show: true },
          { label: `  − Withdrawn (${withdrawnDays}d)`, value: naira(withdrawnAmount), color: "text-red-400",   show: withdrawnAmount > 0 },
          { label: `  − Commission (${commissionDays}d)`, value: naira(commissionHeld), color: "text-yellow-400", show: commissionHeld > 0 },
          { label: "Current balance",          value: naira(card.currentBalance),  color: "text-zinc-300",    show: true },
          { label: `  Available (${availableDays}d)`,   value: naira(withdrawableBalance), color: "text-emerald-400", show: true },
        ] as { label: string; value: string; color: string; show: boolean }[])
          .filter((r) => r.show)
          .map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 font-mono text-xs">{label}</span>
              <span className={cn("font-semibold font-mono text-xs", color)}>{value}</span>
            </div>
          ))}
      </div>

      {/* Withdrawal panel */}
      <WithdrawalPanel card={card} plan={plan} grossSaved={grossDeposited} />

      {/* Calendar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Calendar</p>
          <div className="flex items-center gap-1">
            {centerIndex !== currentIndex && (
              <button
                onClick={() => setCenterIndex(currentIndex)}
                className="text-[11px] font-medium text-zinc-500 hover:text-white px-2 h-7 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setCenterIndex((i) => i - 1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCenterIndex((i) => i + 1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="max-w-sm mx-auto">
          <div key={centerIndex} className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MonthGrid
              year={displayYear}
              month={displayMonth}
              withdrawnSet={withdrawnSet}
              commissionSet={commissionSet}
              availableSet={availableSet}
              dailyAmt={dailyAmt}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 max-w-sm mx-auto">
          <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-emerald-500" /><span>Saved ({availableDays}d)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-red-500" /><span>Withdrawn ({withdrawnDays}d)</span></div>
          {commissionDays > 0 && (
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded" style={{ background: "#D4AF37" }} /><span>Commission ({commissionDays}d)</span></div>
          )}
        </div>
      </div>

      {/* Plan info */}
      {plan && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-1.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold">Savings Plan</p>
          <p className="text-sm font-bold text-white">{plan.name}</p>
          {plan.description && <p className="text-xs text-zinc-500">{plan.description}</p>}
          {plan.bankAccount && (
            <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-0.5">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Payment account</p>
              <p className="text-xs font-mono text-white">{plan.bankAccount.accountNumber}</p>
              <p className="text-xs text-zinc-400">{plan.bankAccount.accountName} · {plan.bankAccount.bankName}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
