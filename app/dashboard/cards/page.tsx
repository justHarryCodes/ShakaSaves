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
  FileDown, ChevronLeft, ChevronRight, BookOpen, RefreshCw, FolderInput, Search,
} from "lucide-react";
import type { SavingsCard, CardRequest, BankAccount, SavingsPlan, ContributionUpdateRequest, MigrationImportRequest, MigrationSubAccount } from "@/types";
import { cn } from "@/lib/utils";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Card detail modal ─────────────────────────────────────────────────────
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function buildMarkedSet(tickedPeriods: string[]): Set<string> {
  return new Set(tickedPeriods);
}

async function downloadExcel(card: SavingsCard, year: number) {
  const XLSX = await import("xlsx");
  const dailyAmt = card.dailyAmount ?? card.contributionAmount ?? 0;
  const markedSet = buildMarkedSet(card.tickedPeriods ?? []);
  const cardLabel = card.cardName ?? "Savings Card";

  const aoa: (string | number)[][] = [];

  // Title + info rows
  aoa.push(["Shakasave Daily Contribution Card"]);
  aoa.push([`Card: ${cardLabel}`, `Daily: ₦${dailyAmt.toLocaleString()}`, `Year: ${year}`]);
  aoa.push([]);

  // Header row: Month | Amount | Day 1 … Day 31
  aoa.push(["Month", "Amount (₦)", ...Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`)]);

  let grandTotal = 0;

  for (let m = 0; m < 12; m++) {
    const monthStr = String(m + 1).padStart(2, "0");
    const dim = daysInMonth(year, m);
    const dayValues: (number | "")[] = Array(31).fill("");
    let monthTotal = 0;

    for (let d = 1; d <= dim; d++) {
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

  // Column widths: Month, Amount, then 31 day columns
  ws["!cols"] = [{ wch: 14 }, { wch: 14 }, ...Array(31).fill({ wch: 7 })];

  // Merge title row across all 33 columns
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 32 } }];

  XLSX.utils.book_append_sheet(wb, ws, String(year));
  XLSX.writeFile(wb, `${cardLabel.replace(/\s+/g, "-")}-${year}.xlsx`);
}

function MonthGrid({
  year,
  month,
  markedSet,
  dailyAmt,
}: {
  year: number;
  month: number;
  markedSet: Set<string>;
  dailyAmt: number;
}) {
  const monthStr = String(month + 1).padStart(2, "0");
  const dim = daysInMonth(year, month);
  const markedCount = Array.from({ length: dim }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return markedSet.has(`${year}-${monthStr}-${d}`);
  }).filter(Boolean).length;

  const firstWeekday = new Date(year, month, 1).getDay();

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3 h-full">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {MONTH_NAMES[month]} <span className="text-zinc-500 font-medium">{year}</span>
        </p>
        {markedCount > 0 && (
          <span className="text-[11px] text-gold-400 font-medium">
            {markedCount}d · {naira(markedCount * dailyAmt)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-[10px] text-zinc-600 font-medium text-center">{d}</span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: dim }, (_, i) => {
          const day = i + 1;
          const dayStr = String(day).padStart(2, "0");
          const isMarked = markedSet.has(`${year}-${monthStr}-${dayStr}`);
          return (
            <div
              key={day}
              title={isMarked ? `${MONTH_NAMES[month]} ${day}: ${naira(dailyAmt)}` : undefined}
              className={cn(
                "aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium transition-colors",
                isMarked
                  ? "bg-gold-500 text-black"
                  : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]"
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardDetailModal({
  card,
  onClose,
}: {
  card: SavingsCard | null;
  onClose: () => void;
}) {
  const isMigrated = !!card?.migrated;
  const dailyAmt = (card?.dailyAmount ?? card?.contributionAmount ?? 0);
  const markedSet = buildMarkedSet(card?.tickedPeriods ?? []);

  const now = new Date();
  const currentIndex = now.getFullYear() * 12 + now.getMonth();

  // Continuous month index (year*12+month) so the carousel can slide across
  // year boundaries. Defaults to the current month, or the last marked
  // month if the card has no activity in the current month/year.
  function defaultCenterIndex(c: SavingsCard | null): number {
    const periods = c?.tickedPeriods ?? [];
    if (periods.length === 0) return currentIndex;
    const lastPeriod = [...periods].sort().at(-1)!;
    const y = parseInt(lastPeriod.slice(0, 4));
    const m = parseInt(lastPeriod.slice(5, 7)) - 1;
    return y * 12 + m;
  }

  const [centerIndex, setCenterIndex] = useState(() => defaultCenterIndex(card));
  const [downloading, setDownloading] = useState(false);

  // Re-sync carousel position when switching to a different card
  useEffect(() => {
    if (card) setCenterIndex(defaultCenterIndex(card));
  // card?.id is intentional — only re-sync position when switching to a different card
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  if (!card) return null;

  const year = Math.floor(centerIndex / 12);
  const totalDays = isMigrated
    ? (card.migrationDailyMarking ?? 0)
    : (card.tickedPeriods?.length ?? 0);

  return (
    <Dialog open={!!card} onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-4xl w-[95vw] p-0 overflow-hidden">
        <div className="max-h-[90vh] overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Card header */}
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-white text-xl">
                      {card.cardName ?? "Savings Card"}
                    </DialogTitle>
                    {isMigrated && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20">
                        Migrated
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">
                    {naira(dailyAmt)}/day · {totalDays} days marked · {naira(card.currentBalance)} balance
                  </p>
                </div>
                {!isMigrated && (
                  <Button
                    onClick={async () => {
                      setDownloading(true);
                      try { await downloadExcel(card, year); }
                      finally { setDownloading(false); }
                    }}
                    disabled={downloading}
                    size="sm"
                    className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5 shrink-0 disabled:opacity-60"
                  >
                    <FileDown size={13} /> {downloading ? "Preparing…" : `Download ${year}`}
                  </Button>
                )}
              </div>
            </DialogHeader>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Daily rate",  value: naira(dailyAmt) },
                { label: "Days marked", value: totalDays.toString() },
                { label: isMigrated ? "Card balance" : "Total saved", value: naira(card.currentBalance) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 text-center">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Migrated card: show totals breakdown instead of calendar */}
            {isMigrated ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">History summary</p>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  {[
                    { label: "Total saved (gross)",  value: naira(card.migrationTotalSavings ?? 0) },
                    { label: "Amount withdrawn",     value: naira(card.migrationAmountWtd ?? 0),   accent: true },
                    { label: "Net balance",          value: naira(card.currentBalance),             gold: true },
                  ].map(({ label, value, accent, gold }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">{label}</span>
                      <span className={cn("font-semibold font-mono", gold ? "text-gold-400" : accent ? "text-red-400/80" : "text-white")}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                  <FolderInput size={13} className="text-zinc-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    This card was imported from a physical savings record (code{" "}
                    <span className="font-mono text-zinc-400">{card.migrationCode}</span>).
                    Daily tracking starts from the date your admin approved the migration.
                    Historical dates are not available in the calendar.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Month carousel */}
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
                  <div className="overflow-hidden">
                    <div key={centerIndex} className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-sm mx-auto">
                      <MonthGrid
                        year={Math.floor(centerIndex / 12)}
                        month={((centerIndex % 12) + 12) % 12}
                        markedSet={markedSet}
                        dailyAmt={dailyAmt}
                      />
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs text-zinc-600 pb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-gold-500" />
                    <span>Marked day</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded border border-white/[0.1]" />
                    <span>Unmarked</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Card tile ─────────────────────────────────────────────────────────
function CardTile({ card, onViewDetails }: { card: SavingsCard; onViewDetails: () => void }) {
  const isMigrated = !!card.migrated;
  const days = isMigrated
    ? (card.migrationDailyMarking ?? 0)
    : (card.tickedPeriods?.length ?? 0);
  const dailyAmt = card.dailyAmount ?? card.contributionAmount ?? 0;
  const estimatedTotal = dailyAmt * 365;
  const pct = estimatedTotal > 0 ? Math.min(100, (card.currentBalance / estimatedTotal) * 100) : 0;

  return (
    <div className={cn(
      "rounded-2xl border p-5 space-y-4",
      isMigrated ? "border-gold-500/20 bg-[#0D0D0D]" : "border-white/[0.07] bg-[#0D0D0D]"
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white truncate">{card.cardName ?? "Savings Card"}</h3>
            {isMigrated && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20 shrink-0">
                Migrated
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{naira(dailyAmt)}/day</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-gold-500/20 shrink-0"
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
      {!isMigrated && days > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {(card.tickedPeriods ?? []).slice(-5).map((p) => (
            <span key={p} className="text-[10px] font-mono bg-gold-500/10 text-gold-400 border border-gold-500/20 px-1.5 py-0.5 rounded">
              {p}
            </span>
          ))}
          {days > 5 && <span className="text-[10px] text-zinc-600 self-center">+{days - 5} more</span>}
        </div>
      )}
      {isMigrated && (
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
          <FolderInput size={11} />
          <span>Physical card record · code <span className="font-mono">{card.migrationCode}</span></span>
        </div>
      )}
      <button
        onClick={onViewDetails}
        className="w-full h-8 rounded-xl border border-white/[0.08] text-xs font-medium text-zinc-400 hover:text-white hover:border-white/[0.18] hover:bg-white/[0.03] transition-all"
      >
        Card details
      </button>
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

// ── Browse plans section ──────────────────────────────────────────────
function BrowsePlansSection({
  plans,
  loading,
  onJoin,
}: {
  plans: SavingsPlan[];
  loading: boolean;
  onJoin: (plan: SavingsPlan) => void;
}) {
  if (!loading && plans.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen size={14} className="text-zinc-500" />
        <h3 className="text-sm font-semibold text-white">Savings Plans</h3>
        <span className="text-xs text-zinc-600">— join a plan to start saving</span>
      </div>
      {loading ? (
        <div className="flex gap-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-48 shrink-0 rounded-2xl bg-white/[0.04]" />)}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="shrink-0 w-52 snap-start rounded-2xl border border-white/[0.07] bg-[#0D0D0D] p-4 space-y-2.5"
            >
              <div className="min-h-[48px]">
                <p className="text-sm font-bold text-white truncate">{plan.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">{plan.description}</p>
              </div>
              <p className="text-xs font-semibold" style={{ color: "#D4AF37" }}>Min {naira(plan.minAmount)}/day</p>
              <button
                onClick={() => onJoin(plan)}
                className="w-full h-8 rounded-xl text-xs font-semibold text-black transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
              >
                Join plan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contribution rate section ─────────────────────────────────────────
function ContributionRateSection({
  currentAmount,
  pending,
  canRequest,
  loading,
  onSubmit,
}: {
  currentAmount: number;
  pending: ContributionUpdateRequest | null;
  canRequest: boolean;
  loading: boolean;
  onSubmit: (amount: number) => Promise<void>;
}) {
  const [newAmount, setNewAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Skeleton className="h-24 rounded-2xl bg-white/[0.04]" />;
  if (!currentAmount) return null;

  async function handleSubmit() {
    const amt = Number(newAmount);
    if (!amt || amt <= 0 || amt === currentAmount) {
      toast.error("Enter a valid new amount different from your current rate");
      return;
    }
    setSubmitting(true);
    try { await onSubmit(amt); setNewAmount(""); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0D0D0D] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCw size={13} className="text-zinc-500" />
        <h3 className="text-sm font-semibold text-white">Daily contribution rate</h3>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Current rate</p>
          <p className="text-xl font-bold text-white mt-0.5">
            {naira(currentAmount)}<span className="text-xs text-zinc-500 font-normal">/day</span>
          </p>
        </div>
        {pending && (
          <div className={cn(
            "text-xs font-semibold px-3 py-1.5 rounded-full border",
            pending.status === "pending"
              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
              : pending.status === "approved"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          )}>
            {pending.status === "pending" && `${naira(pending.requestedAmount)}/day — pending`}
            {pending.status === "approved" && `Updated to ${naira(pending.requestedAmount)} ✓`}
            {pending.status === "rejected" && "Update rejected"}
          </div>
        )}
      </div>

      {!pending && canRequest && (
        <div className="space-y-2 pt-1 border-t border-white/[0.04]">
          <p className="text-xs text-zinc-500">Request a new daily rate</p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="New amount (₦)"
              min={1}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="flex-1 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-9 rounded-xl text-sm"
            />
            <Button
              onClick={handleSubmit}
              disabled={submitting || !newAmount || Number(newAmount) === currentAmount || Number(newAmount) <= 0}
              className="h-9 px-4 rounded-xl font-semibold text-black text-sm disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
            >
              {submitting ? "Sending…" : "Request"}
            </Button>
          </div>
        </div>
      )}

      {!pending && !canRequest && (
        <p className="text-[11px] text-zinc-600 border-t border-white/[0.04] pt-3">
          Rate updates can be requested from the 25th of each month
        </p>
      )}

      {pending?.status === "rejected" && pending.rejectionReason && (
        <p className="text-[11px] text-red-400 border-t border-white/[0.04] pt-3">
          Reason: {pending.rejectionReason}
        </p>
      )}
    </div>
  );
}

// ── Migration section ─────────────────────────────────────────────────
interface MigrationPreview {
  card: {
    migrationCode: string;
    primaryName: string;
    subAccounts: MigrationSubAccount[];
  };
  totals: { totalSavings: number; totalWtd: number; totalBal: number; totalCommission: number };
  alreadySubmitted: boolean;
  existingStatus: string | null;
}

function MigrationSection({
  migration,
  idToken,
  onSubmitted,
}: {
  migration: MigrationImportRequest | null;
  idToken: string;
  onSubmitted: () => void;
}) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Don't show the section once approved — migrated cards appear in the cards grid
  if (migration?.status === "approved") return null;

  async function handlePreview() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      const res = await fetch(`/api/v1/cards/migrate/preview?code=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setPreview(json.data);
      } else {
        setPreviewError(json.error?.message ?? "Code not found");
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit() {
    if (!preview) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/cards/migrate", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ migrationCode: preview.card.migrationCode }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Migration submitted! Admin will review and approve your records.");
        setPreview(null);
        setCode("");
        onSubmitted();
      } else {
        toast.error(json.error?.message ?? "Failed to submit");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isPending = migration?.status === "pending";
  const isRejected = migration?.status === "rejected";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0D0D0D] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FolderInput size={13} className="text-zinc-500" />
        <h3 className="text-sm font-semibold text-white">Migrate your physical card</h3>
      </div>

      {isPending && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 space-y-1">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">
              Migration under review — {migration!.migrationCode}
            </span>
          </div>
          <p className="text-xs text-zinc-500 pl-6">
            {migration!.subAccounts.length} sub-account{migration!.subAccounts.length > 1 ? "s" : ""} ·{" "}
            {naira(migration!.subAccounts.reduce((s, a) => s + a.cardBal, 0))} total balance
          </p>
        </div>
      )}

      {isRejected && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 space-y-1">
          <div className="flex items-center gap-2">
            <XCircle size={15} className="text-red-400" />
            <span className="text-sm font-semibold text-red-400">
              Migration not approved — {migration!.migrationCode}
            </span>
          </div>
          {migration!.rejectionReason && (
            <p className="text-xs text-red-400/70 pl-6">Reason: {migration!.rejectionReason}</p>
          )}
          <p className="text-xs text-zinc-500 pl-6 pt-1">Enter a new code below to try again.</p>
        </div>
      )}

      {!isPending && (
        <>
          {!preview ? (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Have a ShakaSave physical savings card? Enter your migration code to digitise your records.
              </p>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setPreviewError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handlePreview()}
                  placeholder="e.g. SS01"
                  maxLength={10}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl px-4 py-2 text-sm font-mono uppercase focus:outline-none focus:border-gold-500/40"
                />
                <Button
                  onClick={handlePreview}
                  disabled={previewLoading || !code.trim()}
                  className="h-10 px-4 rounded-xl font-semibold text-black text-sm disabled:opacity-50 shrink-0"
                  style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
                >
                  {previewLoading ? "…" : <Search size={15} />}
                </Button>
              </div>
              {previewError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <XCircle size={12} /> {previewError}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview card */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{preview.card.primaryName}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Code <span className="font-mono text-zinc-400">{preview.card.migrationCode}</span>
                      {" · "}{preview.card.subAccounts.length} sub-account{preview.card.subAccounts.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500">Net balance</p>
                    <p className="text-base font-bold text-gold-400">{naira(preview.totals.totalBal)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-1">
                  <div style={{ minWidth: "400px" }} className="px-1">
                    <div className="flex text-[10px] text-zinc-600 uppercase tracking-wider pb-1 border-b border-white/[0.04]">
                      <span className="w-28 shrink-0">Category</span>
                      <span className="w-14 text-right shrink-0">Days</span>
                      <span className="w-28 text-right shrink-0">Total saved</span>
                      <span className="w-28 text-right shrink-0">Balance</span>
                    </div>
                    {preview.card.subAccounts.map((sub, i) => {
                      const days = sub.dailyMarking > 0 ? Math.round(sub.totalSavings / sub.dailyMarking) : 0;
                      return (
                        <div key={i} className="flex text-xs py-1.5 border-b border-white/[0.03] last:border-0">
                          <span className="w-28 shrink-0 text-zinc-400">{sub.category}</span>
                          <span className="w-14 text-right shrink-0 text-zinc-500">{days}d</span>
                          <span className="w-28 text-right shrink-0 font-mono text-zinc-300">{naira(sub.totalSavings)}</span>
                          <span className="w-28 text-right shrink-0 font-mono font-semibold text-gold-400">{naira(sub.cardBal)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] text-zinc-600 border-t border-white/[0.04] pt-2">
                  These records will be reviewed by admin before being attached to your account. You cannot edit migrated data after submission.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => { setPreview(null); setCode(""); }}
                  variant="outline"
                  className="h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent"
                >
                  ← Change code
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-10 rounded-xl font-semibold text-black disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
                >
                  {submitting ? "Submitting…" : "Submit for import"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Request card modal — 3 steps ──────────────────────────────────────
const TIMER_DURATION = 20 * 60;

function RequestCardModal({
  open,
  onClose,
  onRequested,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  onRequested: () => void;
  prefill?: { cardName?: string; minAmount?: number };
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

  // Apply prefill values whenever the modal opens
  useEffect(() => {
    if (!open) return;
    if (prefill?.cardName) setCardName(prefill.cardName);
    if (prefill?.minAmount) setDailyAmount(String(prefill.minAmount));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (step !== 2 || !idToken) return;
    fetch("/api/v1/settings", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.settings?.accounts) setBankAccounts(j.data.settings.accounts);
      })
      .catch(() => {});
  }, [step, idToken]);

  useEffect(() => {
    if (step !== 2) { clearInterval(intervalRef.current!); return; }
    setSecondsLeft(TIMER_DURATION);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
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
    setCardName(""); setDailyAmount(""); setFirstPayment("");
    setProofFile(null); setStep(1); setSecondsLeft(TIMER_DURATION);
    clearInterval(intervalRef.current!);
  }

  function handleClose() { reset(); onClose(); }

  function handleStep1Continue() {
    if (!cardName.trim()) { toast.error("Please enter a card name"); return; }
    if (daily <= 0) { toast.error("Daily amount must be greater than 0"); return; }
    if (payment < daily) { toast.error(`First payment must be at least ${naira(daily)}`); return; }
    setStep(2);
  }

  function handlePaid() { clearInterval(intervalRef.current!); setStep(3); }

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
        reset(); onRequested(); onClose();
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
        {step === 2 && (
          <div className="h-1 bg-white/[0.06]">
            <div
              className="h-full transition-all duration-1000"
              style={{ width: `${timerPct}%`, background: urgent ? "#EF4444" : "linear-gradient(90deg,#D4AF37,#B8962E)" }}
            />
          </div>
        )}
        <div className="p-6 space-y-5">
          <div>
            <DialogHeader>
              <DialogTitle className="text-white">
                {step === 1 && "Request a savings card"}
                {step === 2 && "Make your first payment"}
                {step === 3 && "Upload payment proof"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2 mt-3">
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      done ? "bg-gold-500/20 text-gold-500" : active ? "bg-gold-500 text-black" : "bg-white/10 text-zinc-500"
                    )}>
                      {done ? <CheckCircle2 size={13} /> : n}
                    </div>
                    <span className={cn("text-[11px] font-medium", active ? "text-zinc-300" : "text-zinc-600")}>{label}</span>
                    {i < stepLabels.length - 1 && <div className={cn("w-6 h-px", done ? "bg-gold-500/40" : "bg-white/10")} />}
                  </div>
                );
              })}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Card name</Label>
                <Input placeholder="e.g. House fund, School fees…" value={cardName}
                  onChange={(e) => setCardName(e.target.value)} maxLength={60}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Daily contribution (₦)</Label>
                <Input type="number" placeholder="e.g. 500" min={1} value={dailyAmount}
                  onChange={(e) => setDailyAmount(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl" />
                {daily > 0 && (
                  <p className="text-[11px] text-zinc-600">≈ {naira(daily * 30)}/month · {naira(daily * 365)}/year</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">First commitment payment (₦)</Label>
                <Input type="number" placeholder={daily > 0 ? `Min. ${naira(daily)}` : "Enter daily amount first"}
                  min={daily > 0 ? daily : 1} value={firstPayment}
                  onChange={(e) => setFirstPayment(e.target.value)} disabled={daily <= 0}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl disabled:opacity-40" />
                {daysPreview > 0 && (
                  <p className="text-[11px] text-emerald-400">
                    → {daysPreview} day{daysPreview !== 1 ? "s" : ""} will be marked on approval
                  </p>
                )}
              </div>
              <Button type="button" disabled={!cardName.trim() || daily <= 0 || daysPreview < 1}
                onClick={handleStep1Continue}
                className="w-full h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold disabled:opacity-50">
                Continue to payment →
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
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
              <div className="rounded-xl border border-gold-500/20 p-4 text-center"
                style={{ background: "rgba(212,175,55,0.05)" }}>
                <p className="text-xs text-zinc-500 mb-1">Transfer exactly</p>
                <p className="text-3xl font-bold text-gold-400">{naira(payment)}</p>
              </div>
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
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText(acct.accountNumber); toast.success("Copied!"); }}
                          className="text-zinc-500 hover:text-white transition-colors p-1">
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
                <Button type="button" variant="outline" onClick={() => setStep(1)}
                  className="h-11 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent">
                  ← Back
                </Button>
                <Button type="button" onClick={handlePaid}
                  className="h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
                  <CheckCircle2 size={15} className="mr-1.5" /> I have paid
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-zinc-500">
                Upload a screenshot or receipt confirming your transfer of{" "}
                <span className="text-gold-400 font-semibold">{naira(payment)}</span>.
              </p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full h-28 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 transition-colors",
                  proofFile ? "border-gold-500/40 bg-gold-500/[0.04]" : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                )}>
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
                <Button type="button" variant="outline" onClick={() => setStep(2)}
                  className="h-11 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent">
                  ← Back
                </Button>
                <Button type="submit" disabled={loading || !proofFile}
                  className="h-11 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold disabled:opacity-50">
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
  const [plans, setPlans] = useState<SavingsPlan[]>([]);
  const [contribStatus, setContribStatus] = useState<{
    pending: ContributionUpdateRequest | null;
    canRequest: boolean;
    currentAmount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SavingsPlan | null>(null);
  const [detailCard, setDetailCard] = useState<SavingsCard | null>(null);
  const [migration, setMigration] = useState<MigrationImportRequest | null>(null);

  const fetchData = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const [cardsRes, reqRes, plansRes, contribRes, migRes] = await Promise.all([
        fetch("/api/v1/cards", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/v1/cards/request", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/v1/savings-plans", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/v1/customers/me/contribution-update", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/v1/cards/migrate", { headers: { Authorization: `Bearer ${idToken}` } }),
      ]);
      const [cardsJson, reqJson, plansJson, contribJson, migJson] = await Promise.all([
        cardsRes.json(), reqRes.json(), plansRes.json(), contribRes.json(), migRes.json(),
      ]);
      if (cardsJson.success) setCards(cardsJson.data.cards);
      if (reqJson.success) setRequests(reqJson.data.requests);
      if (plansJson.success) setPlans(plansJson.data.plans);
      if (contribJson.success) setContribStatus(contribJson.data);
      if (migJson.success) setMigration(migJson.data.migration);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function submitRateUpdate(amount: number) {
    if (!idToken) return;
    const res = await fetch("/api/v1/customers/me/contribution-update", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requestedAmount: amount }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Rate update request submitted. Admin will review it.");
      fetchData();
    } else {
      toast.error(json.error?.message ?? "Failed to submit request");
      throw new Error(json.error?.message);
    }
  }

  const pendingRequest = requests.find((r) => r.status === "pending") ?? null;
  const latestNonApproved = requests.find((r) => r.status === "rejected") ?? null;
  const totalBalance = cards.reduce((s, c) => s + (c.currentBalance ?? 0), 0);
  const totalDays = cards.reduce((s, c) => s + (c.tickedPeriods?.length ?? 0), 0);

  const modalOpen = showRequest || !!selectedPlan;
  const modalPrefill = selectedPlan
    ? { cardName: selectedPlan.name, minAmount: selectedPlan.minAmount }
    : undefined;

  return (
    <div className="space-y-6 max-w-2xl">
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

      {pendingRequest && <RequestStatusBanner request={pendingRequest} />}
      {!pendingRequest && latestNonApproved && <RequestStatusBanner request={latestNonApproved} />}

      <BrowsePlansSection
        plans={plans}
        loading={loading}
        onJoin={(plan) => setSelectedPlan(plan)}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-2xl bg-white/[0.04]" />)}
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
            <Button onClick={() => setShowRequest(true)}
              className="h-9 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm gap-1.5">
              <Plus size={14} /> Request your first card
            </Button>
          )}
        </div>
      ) : (
        <div className={cn("grid gap-4", cards.length > 1 ? "sm:grid-cols-2" : "")}>
          {cards.map((card) => (
            <CardTile key={card.id} card={card} onViewDetails={() => setDetailCard(card)} />
          ))}
        </div>
      )}

      <ContributionRateSection
        currentAmount={contribStatus?.currentAmount ?? 0}
        pending={contribStatus?.pending ?? null}
        canRequest={contribStatus?.canRequest ?? false}
        loading={loading}
        onSubmit={submitRateUpdate}
      />

      <MigrationSection
        migration={migration}
        idToken={idToken!}
        onSubmitted={fetchData}
      />

      <RequestCardModal
        open={modalOpen}
        onClose={() => { setShowRequest(false); setSelectedPlan(null); }}
        onRequested={fetchData}
        prefill={modalPrefill}
      />

      <CardDetailModal
        card={detailCard}
        onClose={() => setDetailCard(null)}
      />
    </div>
  );
}