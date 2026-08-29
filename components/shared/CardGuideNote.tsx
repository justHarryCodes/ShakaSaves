"use client";
import { describeCardRules } from "@/lib/utils/plan-rules";
import { SavingsCalendarLegend } from "@/components/shared/SavingsCalendarLegend";
import { cn } from "@/lib/utils";

interface PlanLike {
  name: string;
  lockDays?: number;
  targetAmount?: number;
  description?: string;
  bankAccount?: { accountNumber: string; accountName: string; bankName: string };
}

interface CardGuideNoteProps {
  category?: string;
  plan: PlanLike | null;
  naira: (n: number) => string;
  availableDays: number;
  withdrawnDays: number;
  commissionDays: number;
  hasBlueBatch?: boolean;
  /** "prose" (dashboard: a plain-language paragraph) or "pills" (admin: dense
   *  rounded badges) — same underlying rules, styled to match each page. */
  variant?: "prose" | "pills";
}

/**
 * "How this card works" — the card's own withdrawal rule, its commission
 * note, and the calendar color key, all in one place. Renders unconditionally
 * (unlike the old "Plan info" box it replaces, which was gated on a live
 * Firestore plan doc existing and so never showed at all for Regular cards).
 */
export function CardGuideNote({
  category, plan, naira, availableDays, withdrawnDays, commissionDays, hasBlueBatch, variant = "prose",
}: CardGuideNoteProps) {
  const rules = describeCardRules(category, plan, naira);

  if (variant === "pills") {
    return (
      <div className="rounded-xl border border-white/[0.06] p-3 space-y-2" style={{ background: "#0D0D0D" }}>
        <p className="text-[10px] text-zinc-600 uppercase tracking-wide">How this card works</p>
        <p className="text-sm font-bold text-white">{rules.name}</p>
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.08]">
            {rules.restriction}
          </span>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border",
            rules.hasCommission ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          )}>
            {rules.commissionNote}
          </span>
          {plan?.bankAccount && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.08]">
              {plan.bankAccount.bankName} · {plan.bankAccount.accountNumber}
            </span>
          )}
        </div>
        <div className="pt-1">
          <SavingsCalendarLegend availableDays={availableDays} withdrawnDays={withdrawnDays} commissionDays={commissionDays} hasBlueBatch={hasBlueBatch} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-1.5">
      <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold">How this card works</p>
      <p className="text-sm font-bold text-white">{rules.name}</p>
      <p className="text-xs text-zinc-500">{rules.restriction}</p>
      <p className="text-xs text-zinc-500">{rules.commissionNote}</p>
      {plan?.bankAccount && (
        <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-0.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Payment account</p>
          <p className="text-xs font-mono text-white">{plan.bankAccount.accountNumber}</p>
          <p className="text-xs text-zinc-400">{plan.bankAccount.accountName} · {plan.bankAccount.bankName}</p>
        </div>
      )}
      <div className="pt-2 mt-2 border-t border-white/[0.06]">
        <SavingsCalendarLegend availableDays={availableDays} withdrawnDays={withdrawnDays} commissionDays={commissionDays} hasBlueBatch={hasBlueBatch} />
      </div>
    </div>
  );
}
