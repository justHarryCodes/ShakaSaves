"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { WithdrawalStatusBadge } from "@/components/shared/WithdrawalStatusBadge";
import { toast } from "sonner";
import type { Withdrawal } from "@/types";
import { fmtDate } from "@/lib/utils/fmt-date";

function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const searchParams = useSearchParams();
  const preselectCardId = searchParams.get("cardId");
  const didPreselect = useRef(false);
  const [eligibility, setEligibility] = useState<{ withdrawableBalance: number; cards: CardEligibility[] } | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  // Card selections: set of selected card IDs + map of cardId → raw amount string
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [cardAmounts, setCardAmounts] = useState<Map<string, string>>(new Map());

  // Bank details
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
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

  // Pre-select the card the customer came from (e.g. "Request withdrawal" on that
  // card's own detail page), once, the first time eligibility data is in.
  useEffect(() => {
    if (!preselectCardId || !eligibility || didPreselect.current) return;
    didPreselect.current = true;
    const card = eligibility.cards.find((c) => c.id === preselectCardId);
    if (card && !card.lockedReason) {
      setSelectedCards(new Set([card.id]));
      setCardAmounts(new Map([[card.id, String(card.withdrawable)]]));
    }
  }, [eligibility, preselectCardId]);

  function toggleCard(card: CardEligibility) {
    const next = new Set(selectedCards);
    const nextAmts = new Map(cardAmounts);
    if (next.has(card.id)) {
      next.delete(card.id);
      nextAmts.delete(card.id);
    } else {
      next.add(card.id);
      nextAmts.set(card.id, String(card.withdrawable)); // pre-fill full amount
    }
    setSelectedCards(next);
    setCardAmounts(nextAmts);
  }

  function setAmount(cardId: string, value: string) {
    setCardAmounts((prev) => new Map(prev).set(cardId, value));
  }

  const total = Array.from(selectedCards).reduce((sum, cid) => {
    const n = Number(cardAmounts.get(cid) ?? "0");
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const cards = eligibility?.cards ?? [];
  const hasPending = withdrawals.some((w) => w.status === "pending");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;

    if (selectedCards.size === 0) { toast.error("Select at least one card to withdraw from"); return; }
    if (!accountNumber.trim()) { toast.error("Enter your account number"); return; }
    if (!accountName.trim()) { toast.error("Enter your account name"); return; }
    if (!bankName.trim()) { toast.error("Enter your bank name"); return; }

    for (const cid of Array.from(selectedCards)) {
      const card = cards.find((c) => c.id === cid);
      const amt = Number(cardAmounts.get(cid) ?? "");
      if (!amt || amt <= 0) { toast.error(`Enter a valid amount for "${card?.cardName ?? cid}"`); return; }
      if (card && amt > card.withdrawable) {
        toast.error(`Amount for "${card.cardName}" exceeds available ${naira(card.withdrawable)}`);
        return;
      }
    }

    const cardSelections = Array.from(selectedCards).map((cid) => ({
      cardId: cid,
      cardName: cards.find((c) => c.id === cid)!.cardName,
      amountFromCard: Number(cardAmounts.get(cid)),
    }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/withdrawals", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          cardSelections,
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          bankName: bankName.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Withdrawal request submitted!");
        setSelectedCards(new Set());
        setCardAmounts(new Map());
        setAccountNumber("");
        setAccountName("");
        setBankName("");
        await loadData();
      } else {
        toast.error(json.error?.message ?? "Request failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pb-8 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Withdraw Savings</h2>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl bg-white/[0.04]" />
          <Skeleton className="h-64 rounded-2xl bg-white/[0.04]" />
        </div>
      ) : hasPending ? (
        <div className="rounded-2xl border border-amber-500/20 p-5" style={{ background: "#0D0D0D" }}>
          <p className="text-amber-400 text-sm font-medium">
            You have a pending withdrawal request. Please wait for it to be processed before submitting a new one.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card picker */}
          <div className="rounded-2xl border border-white/[0.06] p-5 space-y-4" style={{ background: "#0D0D0D" }}>
            <div>
              <p className="text-sm font-semibold text-white">Select cards to withdraw from</p>
              <p className="text-xs text-zinc-600 mt-0.5">Tap a card to select it, then enter how much you want from it</p>
            </div>

            {cards.length === 0 ? (
              <p className="text-sm text-zinc-500 italic">No savings cards found.</p>
            ) : (
              <div className="space-y-2">
                {cards.map((card) => {
                  const selected = selectedCards.has(card.id);
                  const locked = !!card.lockedReason;
                  const rawAmt = cardAmounts.get(card.id) ?? "";
                  const enteredAmt = Number(rawAmt);
                  const amtOk = rawAmt !== "" && !isNaN(enteredAmt) && enteredAmt > 0 && enteredAmt <= card.withdrawable;

                  return (
                    <div key={card.id}>
                      {/* Card row */}
                      <div
                        role={locked ? undefined : "button"}
                        tabIndex={locked ? undefined : 0}
                        onKeyDown={(e) => !locked && (e.key === "Enter" || e.key === " ") && toggleCard(card)}
                        onClick={() => !locked && toggleCard(card)}
                        className={`rounded-xl border transition-all ${
                          locked
                            ? "border-white/[0.04] opacity-50 cursor-not-allowed"
                            : selected
                            ? "border-[#D4AF37]/40 cursor-pointer"
                            : "border-white/[0.08] hover:border-white/20 cursor-pointer"
                        } ${selected ? "rounded-b-none" : ""}`}
                        style={{ background: selected ? "rgba(212,175,55,0.05)" : "#111111" }}
                      >
                        <div className="flex items-center gap-3 p-3.5">
                          {/* Checkbox */}
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              locked
                                ? "border-zinc-700"
                                : selected
                                ? "border-[#D4AF37] bg-[#D4AF37]"
                                : "border-zinc-600"
                            }`}
                          >
                            {selected && (
                              <svg viewBox="0 0 12 10" className="w-3 h-2.5" fill="none" stroke="#000" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 5l3 3 7-7" />
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-white truncate">{card.cardName}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 shrink-0">{card.category}</span>
                            </div>
                            {locked ? (
                              <p className="text-xs text-amber-400 mt-0.5">{card.lockedReason}</p>
                            ) : (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Available: <span className="font-mono text-emerald-400">{naira(card.withdrawable)}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Amount input — shown below selected card */}
                      {selected && !locked && (
                        <div
                          className="rounded-b-xl border border-t-0 border-[#D4AF37]/30 px-4 pt-3 pb-3.5 space-y-1.5"
                          style={{ background: "rgba(212,175,55,0.03)" }}
                        >
                          <label className="text-[10px] text-zinc-500 uppercase tracking-wide">
                            Amount from <span className="text-zinc-300">{card.cardName}</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">₦</span>
                            <input
                              type="number"
                              min={1}
                              max={card.withdrawable}
                              step="any"
                              placeholder="0"
                              value={rawAmt}
                              onChange={(e) => setAmount(card.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className={`w-full bg-white/[0.04] border rounded-lg pl-8 pr-3 py-2.5 text-white font-mono text-sm placeholder-zinc-700 focus:outline-none transition-colors ${
                                rawAmt && !amtOk
                                  ? "border-red-500/40 focus:border-red-500/60"
                                  : "border-white/[0.10] focus:border-[#D4AF37]/50"
                              }`}
                            />
                          </div>
                          {rawAmt && !amtOk && (
                            <p className="text-[11px] text-red-400">
                              {enteredAmt > card.withdrawable ? `Max ${naira(card.withdrawable)}` : "Enter a valid amount"}
                            </p>
                          )}
                          {/* Quick-fill button */}
                          {rawAmt !== String(card.withdrawable) && (
                            <button
                              type="button"
                              onClick={() => setAmount(card.id, String(card.withdrawable))}
                              className="text-[11px] text-[#D4AF37] hover:underline"
                            >
                              Use full amount ({naira(card.withdrawable)})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Running total */}
            {selectedCards.size > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-zinc-500">
                  Total from {selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""}
                </p>
                <p className="font-mono font-bold text-lg" style={{ color: "#D4AF37" }}>{naira(total)}</p>
              </div>
            )}
          </div>

          {/* Bank details — slides in when a card is selected */}
          {selectedCards.size > 0 && (
            <div className="rounded-2xl border border-white/[0.06] p-5 space-y-4" style={{ background: "#0D0D0D" }}>
              <p className="text-sm font-semibold text-white">Bank details</p>

              {[
                { label: "Account number", value: accountNumber, setter: setAccountNumber, placeholder: "e.g. 0123456789" },
                { label: "Account name", value: accountName, setter: setAccountName, placeholder: "Name on the account" },
                { label: "Bank name", value: bankName, setter: setBankName, placeholder: "e.g. GTBank, Access, Opay" },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-xs text-zinc-500 uppercase tracking-wide">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    required
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={submitting || selectedCards.size === 0 || total <= 0 || !accountNumber || !accountName || !bankName}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40"
                style={{ background: "#D4AF37", color: "#0A0A0A" }}
              >
                {submitting ? "Submitting…" : `Request Withdrawal · ${naira(total)}`}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: "#0D0D0D" }}>
          <p className="text-xs text-zinc-600 uppercase tracking-wide px-5 pt-4 pb-2">Withdrawal History</p>
          <div className="divide-y divide-white/[0.04]">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-start justify-between px-5 py-3 gap-3">
                <div>
                  <p className="font-mono font-bold text-white text-sm">{naira(w.amountRequested)}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{fmtDate(w.requestedAt)}</p>
                  {w.cardSelections && w.cardSelections.length > 0 && (
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {w.cardSelections.map((s) => s.cardName).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="text-right space-y-1 shrink-0">
                  <WithdrawalStatusBadge status={w.status} />
                  {w.rejectionReason && <p className="text-xs text-red-400">{w.rejectionReason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
