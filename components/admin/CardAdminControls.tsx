"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SavingsCard, SavingsPlan } from "@/types";
import { resolveEffectivePlan } from "@/lib/utils/plan-rules";
import { computeWithdrawable, computeEarlyExitCommission } from "@/lib/utils/card-withdrawable";
import { tsToMs } from "@/lib/utils/fmt-date";

interface Props {
  card: SavingsCard;
  plan: SavingsPlan | null;
  idToken: string | null;
  naira: (n: number) => string;
  onChanged: () => void;
}

/**
 * Admin-only card management: override the lock period (extend, shorten, unlock,
 * or restore the plan's rule) and withdraw on the customer's behalf. An early
 * withdrawal on a still-locked card deducts the full-term commission first —
 * the figure is pre-filled and can be edited before confirming.
 */
export function CardAdminControls({ card, plan, idToken, naira, onChanged }: Props) {
  const planOnly = resolveEffectivePlan(card.category, plan);
  const effective = resolveEffectivePlan(card.category, plan, card);
  const hasOverride = typeof card.lockDaysOverride === "number";

  const createdMs = tsToMs(card.createdAt);
  const daysHeld = createdMs ? Math.floor((Date.now() - createdMs) / 86_400_000) : 0;

  // ── Lock override ──
  const [lockDays, setLockDays] = useState(String(card.lockDaysOverride ?? effective?.lockDays ?? planOnly?.lockDays ?? ""));
  const [lockReason, setLockReason] = useState(card.lockOverrideReason ?? "");
  const [savingLock, setSavingLock] = useState(false);

  async function saveLock(value: number | null) {
    if (!idToken) return;
    setSavingLock(true);
    try {
      const res = await fetch(`/api/v1/admin/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ lockDaysOverride: value, reason: lockReason || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to update lock");
      toast.success(value === null ? "Lock reset to plan default" : value === 0 ? "Card unlocked" : `Lock set to ${value} days`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update lock");
    } finally {
      setSavingLock(false);
    }
  }

  // ── Withdraw on behalf ──
  const { withdrawable } = computeWithdrawable(card);
  const early = computeEarlyExitCommission(card, effective?.lockDays);
  const [amount, setAmount] = useState("");
  const [commissionInput, setCommissionInput] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [note, setNote] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const amt = Number(amount) || 0;
  const suggestedCommission = Math.min(early.commission, amt);
  const commission = commissionInput !== null && commissionInput !== "" ? Number(commissionInput) : suggestedCommission;
  const payout = amt - commission;
  const amountValid = amt > 0 && amt <= withdrawable;
  const commissionValid = !isNaN(commission) && commission >= 0 && commission <= amt;

  async function submitWithdrawal() {
    if (!idToken || !amountValid || !commissionValid) return;
    if (!confirm(`Withdraw ${naira(amt)} from this card?\nCommission: ${naira(commission)}\nCustomer receives: ${naira(payout)}`)) return;
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/v1/admin/cards/${card.id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          amount: amt,
          commission,
          bankName, accountNumber, accountName,
          note: note || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Withdrawal failed");
      toast.success(`Paid ${naira(json.data.payout)} to customer · ${naira(json.data.commission)} commission`);
      setAmount(""); setCommissionInput(null); setNote("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  }

  const inputCls = "h-9 rounded-lg bg-white/[0.03] border-white/[0.08] text-sm text-white";

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* Lock period */}
      <div className="rounded-xl border border-white/[0.06] p-3 space-y-3" style={{ background: "#0D0D0D" }}>
        <div className="flex items-center gap-2">
          <Lock size={13} className="text-amber-400" />
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Lock period (admin)</p>
        </div>
        <div className="text-xs text-zinc-400 space-y-0.5">
          <p>Plan default: <span className="text-zinc-200">{planOnly?.lockDays ? `${planOnly.lockDays} days` : planOnly?.targetAmount ? `target ${naira(planOnly.targetAmount)}` : "no lock"}</span></p>
          <p>Current rule: <span className="text-zinc-200">{effective?.lockDays ? `${effective.lockDays} days` : effective?.targetAmount ? `target ${naira(effective.targetAmount)}` : "unlocked"}</span>{hasOverride && <span className="text-amber-400"> · overridden</span>}</p>
          <p>Held so far: <span className="text-zinc-200">{daysHeld} days</span>
            {effective?.lockDays ? <> · {Math.max(0, effective.lockDays - daysHeld)} days left</> : null}</p>
        </div>
        <div className="flex gap-2">
          <Input type="number" min={0} value={lockDays} onChange={(e) => setLockDays(e.target.value)} placeholder="Lock days" className={inputCls} />
          <Button disabled={savingLock || lockDays === "" || Number(lockDays) < 0} onClick={() => saveLock(Math.floor(Number(lockDays)))}
            className="h-9 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold">Set</Button>
        </div>
        <Input value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="Reason (optional)" className={inputCls} />
        <div className="flex gap-2">
          <Button variant="outline" disabled={savingLock} onClick={() => saveLock(0)} className="h-8 rounded-lg text-xs">Unlock now</Button>
          {hasOverride && (
            <Button variant="outline" disabled={savingLock} onClick={() => saveLock(null)} className="h-8 rounded-lg text-xs">Reset to plan</Button>
          )}
        </div>
      </div>

      {/* Withdraw on behalf */}
      <div className="rounded-xl border border-white/[0.06] p-3 space-y-3" style={{ background: "#0D0D0D" }}>
        <div className="flex items-center gap-2">
          <Banknote size={13} className="text-emerald-400" />
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Withdraw on behalf of customer</p>
        </div>
        <p className="text-xs text-zinc-400">
          Max from card: <span className="font-mono text-emerald-400">{naira(withdrawable)}</span>
          {early.locked && (
            <> · <span className="text-amber-400">still locked — early-exit commission {early.termMonths} months × {naira(card.dailyAmount ?? 0)}
              {early.fullTermCommission !== early.commission && <> (less {naira(early.fullTermCommission - early.commission)} already held/charged)</>}
              {" "}= {naira(early.commission)}</span></>
          )}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount from card" className={inputCls} />
          <Input type="number" min={0} value={commissionInput ?? String(suggestedCommission)} onChange={(e) => setCommissionInput(e.target.value)} placeholder="Commission" className={inputCls} />
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" className={inputCls} />
          <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" className={inputCls} />
          <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name" className={`${inputCls} col-span-2`} />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={`${inputCls} col-span-2`} />
        </div>
        {amt > 0 && (
          <div className="text-xs space-y-0.5 font-mono">
            <p className="text-zinc-400">Amount from card: <span className="text-white">{naira(amt)}</span></p>
            <p className="text-zinc-400">Admin commission: <span className="text-yellow-400">− {naira(commissionValid ? commission : 0)}</span></p>
            <p className="text-zinc-400">Customer receives: <span className="text-emerald-400">{naira(commissionValid ? payout : 0)}</span></p>
            {!amountValid && <p className="text-red-400">Amount must be between ₦1 and {naira(withdrawable)}</p>}
            {amountValid && !commissionValid && <p className="text-red-400">Commission must be between ₦0 and the amount</p>}
          </div>
        )}
        <Button disabled={withdrawing || !amountValid || !commissionValid} onClick={submitWithdrawal}
          className="w-full h-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold">
          {withdrawing ? "Processing…" : "Withdraw & mark paid"}
        </Button>
      </div>
    </div>
  );
}
