"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, CreditCard, Calendar, TrendingUp } from "lucide-react";
import type { SavingsCard } from "@/types";
import { cn } from "@/lib/utils";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function CardTile({ card }: { card: SavingsCard }) {
  const days = card.tickedPeriods?.length ?? 0;
  const dailyAmt = card.dailyAmount ?? card.contributionAmount ?? 0;
  const estimatedTotal = dailyAmt * 365;
  const pct = estimatedTotal > 0 ? Math.min(100, (card.currentBalance / estimatedTotal) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0D0D0D] p-5 space-y-4">
      {/* Header */}
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

      {/* Balance */}
      <div>
        <p className="text-xs text-zinc-600 uppercase tracking-wide">Balance</p>
        <p className="text-2xl font-bold text-white mt-0.5">{naira(card.currentBalance)}</p>
      </div>

      {/* Progress bar */}
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

      {/* Recent ticked dates */}
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

function CreateCardModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { idToken } = useAuth();
  const [cardName, setCardName] = useState("");
  const [dailyAmount, setDailyAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/cards", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ cardName: cardName.trim(), dailyAmount: Number(dailyAmount) }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`"${cardName}" card created!`);
        setCardName("");
        setDailyAmount("");
        onCreated();
        onClose();
      } else {
        toast.error(json.error?.message ?? "Failed to create card");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border border-white/[0.08] rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">New savings card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Card name</Label>
            <Input
              placeholder="e.g. House fund, School fees…"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              required
              maxLength={60}
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Daily contribution amount (₦)</Label>
            <Input
              type="number"
              placeholder="e.g. 500"
              min={1}
              value={dailyAmount}
              onChange={(e) => setDailyAmount(e.target.value)}
              required
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-10 rounded-xl"
            />
            {dailyAmount && Number(dailyAmount) > 0 && (
              <p className="text-xs text-zinc-500">
                ≈ {naira(Number(dailyAmount) * 30)}/month · {naira(Number(dailyAmount) * 365)}/year
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading || !cardName.trim() || !dailyAmount}
            className="w-full h-10 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create card"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CardsPage() {
  const { idToken } = useAuth();
  const [cards, setCards] = useState<SavingsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/cards", { headers: { Authorization: `Bearer ${idToken}` } });
      const json = await res.json();
      if (json.success) setCards(json.data.cards);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const totalBalance = cards.reduce((s, c) => s + (c.currentBalance ?? 0), 0);
  const totalDays = cards.reduce((s, c) => s + (c.tickedPeriods?.length ?? 0), 0);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">My Savings Cards</h2>
          {!loading && cards.length > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">{cards.length} card{cards.length !== 1 ? "s" : ""} · {totalDays} days marked · {naira(totalBalance)} total</p>
          )}
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="h-9 px-3 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm gap-1.5"
        >
          <Plus size={15} /> Add card
        </Button>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-2xl bg-white/[0.04]" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/[0.06] bg-white/[0.02]">
            <TrendingUp size={28} className="text-zinc-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">No savings cards yet</p>
            <p className="text-xs text-zinc-500 mt-1">Create a card to start tracking daily contributions</p>
          </div>
          <Button onClick={() => setShowCreate(true)}
            className="h-9 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm gap-1.5">
            <Plus size={14} /> Create your first card
          </Button>
        </div>
      ) : (
        <div className={cn("grid gap-4", cards.length > 1 ? "sm:grid-cols-2" : "")}>
          {cards.map((card) => <CardTile key={card.id} card={card} />)}
        </div>
      )}

      <CreateCardModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchCards}
      />
    </div>
  );
}
