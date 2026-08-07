"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, Banknote, User,
  CreditCard, Lock, Target, Clock, AlertTriangle, MessageCircle,
} from "lucide-react";
import type { Withdrawal, Customer, SavingsCard, SavingsPlan } from "@/types";
import { cn } from "@/lib/utils";
import { resolveEffectivePlan } from "@/lib/utils/plan-rules";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(v: unknown) {
  if (!v) return "—";
  const ms = (v as { toMillis?: () => number }).toMillis?.() ?? (v as { seconds?: number }).seconds! * 1000;
  return new Date(ms).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Normalise Nigerian phone to WhatsApp international format (234XXXXXXXXXX)
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return digits;
}

function buildWhatsAppLink(phone: string, name: string, amount: number): string {
  const number = toWhatsAppNumber(phone);
  const message = [
    `Hello ${name} 👋`,
    ``,
    `Your withdrawal request of *${naira(amount)}* from *Shaka Saves* has been processed ✅`,
    ``,
    `The funds have been sent to your account. Please confirm receipt.`,
    ``,
    `Thank you for saving with us! 💛`,
  ].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

type CardWithPlan = SavingsCard & { plan: SavingsPlan | null };

// ── Per-card eligibility chip ─────────────────────────────────────────
function CardEligibilityChip({ card }: { card: CardWithPlan }) {
  const effective = resolveEffectivePlan(card.category, card.plan);

  if (!effective) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 size={9} /> Withdrawable
      </span>
    );
  }

  if (effective.lockDays) {
    const createdMs = (card.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? Date.now();
    const daysHeld = Math.floor((Date.now() - createdMs) / 86_400_000);
    const unlocked = daysHeld >= effective.lockDays;
    const daysLeft = Math.max(0, effective.lockDays - daysHeld);
    return unlocked ? (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 size={9} /> Unlocked
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Lock size={9} /> Locked {daysLeft}d left
      </span>
    );
  }

  if (effective.targetAmount) {
    const reached = card.currentBalance >= effective.targetAmount;
    return reached ? (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 size={9} /> Target reached
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Target size={9} /> {naira(effective.targetAmount - card.currentBalance)} to go
      </span>
    );
  }

  // Non-Regular with no specific conditions → locked
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Lock size={9} /> Restricted
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────
export default function WithdrawalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { idToken } = useAuth();

  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cards, setCards] = useState<CardWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    if (!idToken || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/withdrawals/${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setWithdrawal(json.data.withdrawal);
        setCustomer(json.data.customer ?? null);
        setCards(json.data.cards ?? []);
      } else {
        toast.error("Withdrawal not found");
        router.push("/admin/withdrawals");
      }
    } finally {
      setLoading(false);
    }
  }, [idToken, id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function doAction(endpoint: string, body?: object) {
    if (!withdrawal) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/withdrawals/${withdrawal.id}/${endpoint}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Done");
        await fetchData();
        setShowReject(false);
        setReason("");
      } else {
        toast.error(json.error?.message ?? "Action failed");
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl bg-white/[0.04]" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
        </div>
        <Skeleton className="h-40 rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  if (!withdrawal) return null;

  const statusColors: Record<string, string> = {
    pending:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
    approved: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    paid:     "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rejected: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  const totalBalance = cards.reduce((s, c) => s + (c.currentBalance ?? 0), 0);

  return (
    <div className="space-y-5 pb-8 max-w-2xl">

      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin/withdrawals")}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">Withdrawal Request</h1>
          <p className="text-xs text-zinc-600 font-mono">{withdrawal.id}</p>
        </div>
        <span className={cn("ml-auto text-xs font-semibold px-2.5 py-1 rounded-full border capitalize", statusColors[withdrawal.status])}>
          {withdrawal.status}
        </span>
      </div>

      {/* Amount + date */}
      <div className="rounded-2xl border border-white/[0.07] p-5 space-y-3" style={{ background: "#0D0D0D" }}>
        <div className="flex items-center gap-2 text-zinc-500">
          <Banknote size={14} />
          <span className="text-xs uppercase tracking-wide font-medium">Amount requested</span>
        </div>
        <p className="text-4xl font-bold" style={{ color: "#D4AF37" }}>{naira(withdrawal.amountRequested)}</p>
        <div className="flex flex-wrap gap-4 text-xs text-zinc-500 pt-1 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5">
            <Clock size={11} />
            <span>Requested {fmtDate(withdrawal.requestedAt)}</span>
          </div>
          {withdrawal.reviewedAt && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={11} />
              <span>Reviewed {fmtDate(withdrawal.reviewedAt)}</span>
            </div>
          )}
        </div>
        {/* Bank details */}
        {(withdrawal.accountNumber || withdrawal.accountName || withdrawal.bankName) && (
          <div className="rounded-xl border border-white/[0.08] px-4 py-3 space-y-1.5" style={{ background: "#111" }}>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-2">Payment destination</p>
            {withdrawal.bankName && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Bank</span>
                <span className="text-white font-semibold">{withdrawal.bankName}</span>
              </div>
            )}
            {withdrawal.accountName && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Account name</span>
                <span className="text-white font-semibold">{withdrawal.accountName}</span>
              </div>
            )}
            {withdrawal.accountNumber && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Account number</span>
                <span className="font-mono text-white font-bold tracking-wider">{withdrawal.accountNumber}</span>
              </div>
            )}
          </div>
        )}
        {withdrawal.note && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-xs text-zinc-400 italic">
            &ldquo;{withdrawal.note}&rdquo;
          </div>
        )}
        {withdrawal.rejectionReason && (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/[0.06] border border-red-500/20 px-3 py-2.5">
            <XCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400">{withdrawal.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* Customer info */}
      <div className="rounded-2xl border border-white/[0.07] p-4 space-y-3" style={{ background: "#0D0D0D" }}>
        <div className="flex items-center gap-2 text-zinc-500 mb-1">
          <User size={13} />
          <span className="text-xs uppercase tracking-wide font-medium">Customer</span>
        </div>
        {customer ? (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-white">{customer.fullName}</p>
                <div className="flex flex-wrap gap-3 mt-0.5">
                  {customer.email && <p className="text-xs text-zinc-500">{customer.email}</p>}
                  {customer.phone && <p className="text-xs text-zinc-500">{customer.phone}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Account balance</p>
                <p className="text-lg font-bold text-emerald-400">{naira(customer.currentBalance ?? 0)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 border-t border-white/[0.05]">
              <div className="text-xs text-zinc-500">
                <span className="text-zinc-600">Total savings across cards:</span>{" "}
                <span className="text-white font-semibold">{naira(totalBalance)}</span>
              </div>
              <div className="text-xs text-zinc-500">
                <span className="text-zinc-600">ID:</span>{" "}
                <span className="font-mono text-zinc-400">{customer.id?.slice(-10).toUpperCase()}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-600 italic">Customer not found</p>
        )}
      </div>

      {/* Card deduction breakdown — sourced from the user's explicit selection */}
      {withdrawal.cardSelections && withdrawal.cardSelections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-500 px-1">
            <CreditCard size={13} />
            <span className="text-xs uppercase tracking-wide font-medium">Deduction breakdown</span>
          </div>
          <div
            className="rounded-2xl border border-white/[0.06] overflow-hidden"
            style={{ background: "#0D0D0D" }}
          >
            {withdrawal.cardSelections.map((sel, i) => {
              const card = cards.find((c) => c.id === sel.cardId);
              return (
                <div
                  key={sel.cardId}
                  className={`flex items-center justify-between px-4 py-3 gap-3 ${
                    i > 0 ? "border-t border-white/[0.05]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{sel.cardName}</p>
                      {card?.category && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 shrink-0">
                          {card.category}
                        </span>
                      )}
                      {card?.migrated && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 shrink-0">
                          migrated
                        </span>
                      )}
                    </div>
                    {card && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Balance after: <span className="font-mono text-emerald-400">
                          {withdrawal.status === "paid"
                            ? naira(Math.max(0, (card.currentBalance ?? 0)))
                            : naira(Math.max(0, (card.currentBalance ?? 0) - sel.amountFromCard))}
                        </span>
                      </p>
                    )}
                  </div>
                  <p className="font-mono font-bold shrink-0" style={{ color: "#D4AF37" }}>
                    {naira(sel.amountFromCard)}
                  </p>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.08]" style={{ background: "#0A0A0A" }}>
              <p className="text-xs text-zinc-500">Total</p>
              <p className="font-mono font-bold text-white">{naira(withdrawal.amountRequested)}</p>
            </div>
          </div>
        </div>
      )}

      {/* All savings cards — shown when there is no explicit selection (legacy) */}
      {(!withdrawal.cardSelections || withdrawal.cardSelections.length === 0) && cards.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-500 px-1">
            <CreditCard size={13} />
            <span className="text-xs uppercase tracking-wide font-medium">Savings cards</span>
          </div>
          <div className="space-y-2">
            {cards.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-white/[0.06] p-3 flex items-center justify-between gap-3"
                style={{ background: "#0D0D0D" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{card.cardName ?? "Card"}</p>
                    {card.category && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20">
                        {card.category}
                      </span>
                    )}
                    {card.migrated && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        migrated
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {naira(card.dailyAmount ?? 0)}/day · {card.tickedPeriods?.length ?? 0} days marked
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-bold text-emerald-400">{naira(card.currentBalance ?? 0)}</p>
                  <CardEligibilityChip card={card} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {withdrawal.status === "pending" && !showReject && (
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => doAction("approve")}
            disabled={actionLoading}
            className="flex-1 h-11 rounded-xl font-semibold text-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)" }}
          >
            <CheckCircle2 size={16} /> Approve
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={actionLoading}
            className="flex-1 h-11 rounded-xl font-semibold text-red-400 text-sm flex items-center justify-center gap-2 border border-red-500/20 bg-red-500/[0.05] hover:bg-red-500/[0.1] transition-colors disabled:opacity-50"
          >
            <XCircle size={16} /> Reject
          </button>
        </div>
      )}

      {withdrawal.status === "pending" && showReject && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <p className="text-sm font-semibold text-red-400">Reject this withdrawal?</p>
          </div>
          <Textarea
            placeholder="Reason for rejection…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl resize-none focus:border-red-500/40"
          />
          <div className="flex gap-2">
            <button
              onClick={() => doAction("reject", { rejectionReason: reason })}
              disabled={!reason.trim() || actionLoading}
              className="flex-1 h-10 rounded-xl font-semibold text-white text-sm bg-red-500 hover:bg-red-400 transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Rejecting…" : "Confirm rejection"}
            </button>
            <button
              onClick={() => { setShowReject(false); setReason(""); }}
              className="h-10 px-4 rounded-xl text-sm text-zinc-400 hover:text-white border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {withdrawal.status === "approved" && (
        <button
          onClick={() => doAction("mark-paid")}
          disabled={actionLoading}
          className="w-full h-11 rounded-xl font-semibold text-white text-sm bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Banknote size={16} /> Mark as Paid
        </button>
      )}

      {/* WhatsApp proof — shown once paid */}
      {withdrawal.status === "paid" && customer && (
        <div className="rounded-2xl border border-emerald-500/20 p-4 space-y-3" style={{ background: "#0D0D0D" }}>
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-emerald-400" />
            <p className="text-sm font-semibold text-white">Send payment confirmation</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Send proof of payment to{" "}
            <span className="text-white font-semibold">{customer.fullName}</span>
            {customer.phone && (
              <> via WhatsApp (<span className="font-mono text-zinc-400">{customer.phone}</span>)</>
            )}
            .
          </p>
          {customer.phone ? (
            <a
              href={buildWhatsAppLink(customer.phone, customer.fullName, withdrawal.amountRequested)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
              style={{ background: "#25D366" }}
            >
              <MessageCircle size={16} />
              Open WhatsApp
            </a>
          ) : (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle size={12} /> No phone number on this customer&apos;s profile.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
