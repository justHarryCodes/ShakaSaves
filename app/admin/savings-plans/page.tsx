"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, PowerOff, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavingsPlan } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

interface PlanFormProps {
  plan?: SavingsPlan;
  idToken: string;
  onClose: () => void;
  onDone: () => void;
}

function PlanFormModal({ plan, idToken, onClose, onDone }: PlanFormProps) {
  const editing = !!plan;
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [minAmount, setMinAmount] = useState(plan?.minAmount ? String(plan.minAmount) : "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !description.trim() || !minAmount) {
      toast.error("All fields are required");
      return;
    }
    const min = Number(minAmount);
    if (!min || min <= 0) { toast.error("Min amount must be positive"); return; }

    setLoading(true);
    try {
      const url = editing ? `/api/v1/admin/savings-plans/${plan!.id}` : "/api/v1/admin/savings-plans";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), minAmount: min }),
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{editing ? "Edit plan" : "New savings plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Plan name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gold Savings"
              className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this plan about?"
              className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-gold-500/40"
            />
          </div>
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
  plan,
  idToken,
  onClose,
  onDone,
}: {
  plan: SavingsPlan;
  idToken: string;
  onClose: () => void;
  onDone: () => void;
}) {
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Savings Plans</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Create named plans customers can opt into</p>
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
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={() => setEditing(plan)}
                  onDeactivate={() => setDeactivating(plan)}
                />
              ))}
            </div>
          )}
          {inactive.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Inactive ({inactive.length})</p>
              {inactive.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={() => setEditing(plan)}
                  onDeactivate={() => setDeactivating(plan)}
                />
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
        <DeactivateModal
          plan={deactivating}
          idToken={idToken!}
          onClose={() => setDeactivating(null)}
          onDone={fetchPlans}
        />
      )}
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
  onDeactivate,
}: {
  plan: SavingsPlan;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        plan.isActive
          ? "border-white/[0.08] bg-white/[0.02]"
          : "border-white/[0.04] bg-white/[0.01] opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-white truncate">{plan.name}</p>
            {plan.isActive ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-white/[0.04]">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{plan.description}</p>
          <p className="text-xs text-gold-400 font-semibold mt-2">Min {naira(plan.minAmount)}/day</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors border border-white/[0.06]"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          {plan.isActive && (
            <button
              onClick={onDeactivate}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors border border-white/[0.06]"
              title="Deactivate"
            >
              <PowerOff size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
