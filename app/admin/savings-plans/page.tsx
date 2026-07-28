"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, PowerOff, BookOpen, Lock, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavingsPlan } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

type ConditionType = "none" | "lock_days" | "target_amount";

interface BankAccountFields {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface PlanFormProps {
  plan?: SavingsPlan;
  idToken: string;
  onClose: () => void;
  onDone: () => void;
}

function PlanFormModal({ plan, idToken, onClose, onDone }: PlanFormProps) {
  const editing = !!plan;

  const initialCondition = (): ConditionType => {
    if (plan?.lockDays) return "lock_days";
    if (plan?.targetAmount) return "target_amount";
    return "none";
  };

  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [minAmount, setMinAmount] = useState(plan?.minAmount ? String(plan.minAmount) : "");
  const [condition, setCondition] = useState<ConditionType>(initialCondition);
  const [lockDays, setLockDays] = useState(plan?.lockDays ? String(plan.lockDays) : "");
  const [targetAmount, setTargetAmount] = useState(plan?.targetAmount ? String(plan.targetAmount) : "");
  const [hasBankAccount, setHasBankAccount] = useState(!!(plan?.bankAccount));
  const [bankAccount, setBankAccount] = useState<BankAccountFields>({
    bankName: plan?.bankAccount?.bankName ?? "",
    accountNumber: plan?.bankAccount?.accountNumber ?? "",
    accountName: plan?.bankAccount?.accountName ?? "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !description.trim() || !minAmount) {
      toast.error("Name, description and minimum amount are required");
      return;
    }
    const min = Number(minAmount);
    if (!min || min <= 0) { toast.error("Minimum amount must be positive"); return; }

    if (condition === "lock_days") {
      const d = Number(lockDays);
      if (!d || d <= 0 || !Number.isInteger(d)) { toast.error("Lock days must be a positive whole number"); return; }
    }
    if (condition === "target_amount") {
      const t = Number(targetAmount);
      if (!t || t <= 0) { toast.error("Target amount must be positive"); return; }
    }

    let bankAccountData: { bankName: string; accountNumber: string; accountName: string } | null = null;
    if (hasBankAccount) {
      if (!bankAccount.bankName || !bankAccount.accountNumber || !bankAccount.accountName) {
        toast.error("Fill in all bank account fields, or uncheck the bank account option");
        return;
      }
      bankAccountData = bankAccount;
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      minAmount: min,
      lockDays: condition === "lock_days" ? Number(lockDays) : null,
      targetAmount: condition === "target_amount" ? Number(targetAmount) : null,
      bankAccount: bankAccountData,
    };

    setLoading(true);
    try {
      const url = editing ? `/api/v1/admin/savings-plans/${plan!.id}` : "/api/v1/admin/savings-plans";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editing ? "Plan updated" : "Plan created");
        onDone();
        onClose();
      } else {
        toast.error(json.error?.message ?? "Failed");
      }
    } finally { setLoading(false); }
  }

  const conditionOptions: { value: ConditionType; label: string; desc: string }[] = [
    { value: "none",          label: "No restriction",  desc: "Customers can withdraw any time" },
    { value: "lock_days",     label: "Time lock",       desc: "Card locked for N days from creation" },
    { value: "target_amount", label: "Amount target",   desc: "Must reach ₦ target before withdrawal" },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{editing ? "Edit plan" : "New savings plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Plan name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FoodBank"
              className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500/40"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this plan about?"
              className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-gold-500/40"
            />
          </div>

          {/* Minimum daily amount */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Minimum daily amount (₦)</label>
            <input
              type="number"
              min={1}
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="e.g. 500"
              className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500/40"
            />
          </div>

          {/* Withdrawal condition */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Withdrawal condition</label>
            <div className="space-y-1.5">
              {conditionOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCondition(opt.value)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                    condition === opt.value
                      ? "border-gold-500/40 bg-gold-500/[0.06]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10]"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors",
                    condition === opt.value ? "border-gold-500" : "border-zinc-600"
                  )}>
                    {condition === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-gold-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-xs font-semibold", condition === opt.value ? "text-gold-400" : "text-zinc-300")}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Condition-specific input */}
            {condition === "lock_days" && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-zinc-400">Lock duration (days)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={lockDays}
                  onChange={(e) => setLockDays(e.target.value)}
                  placeholder="e.g. 365 for one year"
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500/40"
                />
                {lockDays && Number(lockDays) > 0 && (
                  <p className="text-[11px] text-zinc-600">
                    ≈ {Math.round(Number(lockDays) / 365 * 10) / 10} year(s) from card creation
                  </p>
                )}
              </div>
            )}

            {condition === "target_amount" && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-zinc-400">Required savings target (₦)</label>
                <input
                  type="number"
                  min={1}
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="e.g. 1000000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500/40"
                />
                {targetAmount && Number(targetAmount) > 0 && (
                  <p className="text-[11px] text-zinc-600">
                    Must save {naira(Number(targetAmount))} before withdrawal is allowed
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Dedicated bank account */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasBankAccount}
                onChange={(e) => setHasBankAccount(e.target.checked)}
                className="w-4 h-4 rounded accent-yellow-500"
              />
              <span className="text-xs text-zinc-400">This plan has a dedicated payment account</span>
            </label>
            {hasBankAccount && (
              <div className="space-y-2 pl-6">
                <p className="text-[11px] text-zinc-600">Customers paying into this plan will see this account.</p>
                {[
                  { label: "Bank name", field: "bankName" as const, placeholder: "e.g. First Bank" },
                  { label: "Account number", field: "accountNumber" as const, placeholder: "e.g. 0123456789" },
                  { label: "Account name", field: "accountName" as const, placeholder: "e.g. Shaka Saves FoodBank" },
                ].map(({ label, field, placeholder }) => (
                  <div key={field} className="space-y-1">
                    <label className="text-[11px] text-zinc-500">{label}</label>
                    <input
                      value={bankAccount[field]}
                      onChange={(e) => setBankAccount((prev) => ({ ...prev, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-gold-500/40"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button onClick={onClose} variant="outline"
              className="h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}
              className="h-10 rounded-xl font-semibold text-black disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}>
              {loading ? (editing ? "Saving…" : "Creating…") : (editing ? "Save changes" : "Create plan")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateModal({
  plan, idToken, onClose, onDone,
}: { plan: SavingsPlan; idToken: string; onClose: () => void; onDone: () => void; }) {
  const [loading, setLoading] = useState(false);
  async function handleDeactivate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/savings-plans/${plan.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) { toast.success("Plan deactivated"); onDone(); onClose(); }
      else toast.error(json.error?.message ?? "Failed");
    } finally { setLoading(false); }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Deactivate plan?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Deactivating <span className="text-white font-semibold">{plan.name}</span> will hide it from customers.
            Existing cards linked to this plan are unaffected.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={onClose} variant="outline"
              className="h-10 rounded-xl border-white/10 text-zinc-400 hover:text-white bg-transparent">
              Keep active
            </Button>
            <Button onClick={handleDeactivate} disabled={loading}
              className="h-10 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-semibold disabled:opacity-50">
              {loading ? "Deactivating…" : "Deactivate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SavingsPlansPage() {
  const { idToken } = useAuth();
  const [plans, setPlans] = useState<SavingsPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SavingsPlan | null>(null);
  const [deactivating, setDeactivating] = useState<SavingsPlan | null>(null);

  const fetchPlans = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/savings-plans", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) setPlans(json.data.plans);
    } finally { setLoading(false); }
  }, [idToken]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const active = plans.filter((p) => p.isActive);
  const inactive = plans.filter((p) => !p.isActive);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Savings Plans</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Create named plans with withdrawal conditions</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="h-9 px-4 rounded-xl font-semibold text-black text-sm"
          style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
        >
          <Plus size={14} className="mr-1.5" /> New plan
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.04]" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="py-24 text-center">
          <BookOpen size={28} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No savings plans yet</p>
          <p className="text-xs text-zinc-700 mt-1">Create your first plan to get started</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Active ({active.length})</p>
              {active.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(plan)} onDeactivate={() => setDeactivating(plan)} />
              ))}
            </div>
          )}
          {inactive.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Inactive ({inactive.length})</p>
              {inactive.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(plan)} onDeactivate={() => setDeactivating(plan)} />
              ))}
            </div>
          )}
        </div>
      )}

      {creating && (
        <PlanFormModal idToken={idToken!} onClose={() => setCreating(false)} onDone={fetchPlans} />
      )}
      {editing && (
        <PlanFormModal plan={editing} idToken={idToken!} onClose={() => setEditing(null)} onDone={fetchPlans} />
      )}
      {deactivating && (
        <DeactivateModal plan={deactivating} idToken={idToken!} onClose={() => setDeactivating(null)} onDone={fetchPlans} />
      )}
    </div>
  );
}

function PlanCard({ plan, onEdit, onDeactivate }: { plan: SavingsPlan; onEdit: () => void; onDeactivate: () => void; }) {
  const conditionLabel = plan.lockDays
    ? `Locked ${plan.lockDays} days from creation`
    : plan.targetAmount
    ? `Target: ${naira(plan.targetAmount)}`
    : "No restriction — withdraw anytime";

  const ConditionIcon = plan.lockDays ? Lock : plan.targetAmount ? Target : null;

  return (
    <div className={cn(
      "rounded-2xl border p-5 transition-colors",
      plan.isActive ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.04] bg-white/[0.01] opacity-60"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-white truncate">{plan.name}</p>
            {plan.isActive ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-white/[0.04]">Inactive</span>
            )}
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{plan.description}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <p className="text-xs text-gold-400 font-semibold">Min {naira(plan.minAmount)}/day</p>
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              {ConditionIcon && <ConditionIcon size={11} className="shrink-0" />}
              {conditionLabel}
            </span>
          </div>
          {plan.bankAccount && (
            <div className="mt-2 text-[11px] text-zinc-600 font-mono">
              {plan.bankAccount.bankName} · {plan.bankAccount.accountNumber} · {plan.bankAccount.accountName}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors border border-white/[0.06]"
            title="Edit">
            <Pencil size={13} />
          </button>
          {plan.isActive && (
            <button onClick={onDeactivate}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors border border-white/[0.06]"
              title="Deactivate">
              <PowerOff size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
