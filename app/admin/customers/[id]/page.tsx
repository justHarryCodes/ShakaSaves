"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthlyTargetRing } from "@/components/shared/MonthlyTargetRing";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import { toast } from "sonner";
import Link from "next/link";
import type { Customer, PaymentSubmission, Contribution } from "@/types";

interface CustomerCard {
  id: string;
  cardName: string;
  category: string;
  dailyAmount: number;
  daysMarked: number;
  totalSavings: number;
  withdrawn: number;
  balance: number;
  migrated: boolean;
  firstPeriod: string | null;
  lastPeriod: string | null;
}

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function CustomerProfilePage({ params }: { params: { id: string } }) {
  const { idToken } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [cards, setCards] = useState<CustomerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState("");

  useEffect(() => {
    if (!idToken) return;
    Promise.all([
      fetch(`/api/v1/customers/${params.id}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json()).then((j) => { if (j.success) { setCustomer(j.data.customer); setMonthlyTarget(j.data.customer.monthlyTarget); } }),
      fetch(`/api/v1/payments?customerId=${params.id}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json()).then((j) => j.success && setPayments(j.data.payments)),
      fetch(`/api/v1/contributions/${params.id}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json()).then((j) => j.success && setContributions(j.data.contributions)),
      fetch(`/api/v1/admin/cards?customerId=${params.id}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json()).then((j) => j.success && setCards(j.data.cards)),
    ]).finally(() => setLoading(false));
  }, [idToken, params.id]);

  // Compute balance from card data — more accurate than customer.currentBalance for
  // migrated users who also have new cards (avoids drift from manual fixes / legacy code).
  const cardBalanceTotal = cards.reduce((s, c) => s + c.balance, 0);
  const displayBalance = cards.length > 0 ? cardBalanceTotal : (customer?.currentBalance ?? 0);
  // Only flag drift when there are cards — otherwise cardBalanceTotal=0 is not meaningful
  const balanceDrift = (customer && cards.length > 0)
    ? Math.abs((customer.currentBalance ?? 0) - cardBalanceTotal)
    : 0;

  const now = new Date();
  const monthSaved = contributions
    .filter((c) => {
      const y = now.getFullYear(), m = now.getMonth() + 1;
      const prefix = `${y}-${String(m).padStart(2, "0")}`;
      return (c.period ?? "").startsWith(prefix);
    })
    .reduce((s, c) => s + c.amount, 0);

  async function saveTarget() {
    if (!idToken || !customer) return;
    const res = await fetch(`/api/v1/customers/${params.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyTarget: Number(monthlyTarget) }),
    });
    const json = await res.json();
    if (json.success) {
      setCustomer((c) => c ? { ...c, monthlyTarget: Number(monthlyTarget) } : null);
      setEditing(false);
      toast.success("Monthly target updated");
    } else {
      toast.error(json.error?.message ?? "Failed to update");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) return <p className="text-slate-400">Customer not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/customers" className="text-slate-400 hover:text-slate-600 text-sm">← Customers</Link>
        <h2 className="text-2xl font-bold">{customer.fullName}</h2>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${customer.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {customer.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Confirmed Balance</p>
            <p className="text-2xl font-mono font-bold text-emerald-600 mt-1">{naira(displayBalance)}</p>
            {cards.length > 1 && (
              <p className="text-xs text-slate-400 mt-1">Across {cards.length} cards</p>
            )}
            {balanceDrift > 0 && (
              <p className="text-xs text-amber-500 mt-1">⚠ Ledger drift: {naira(balanceDrift)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Plan</p>
            <p className="text-xl font-semibold mt-1">{naira(customer.contributionAmount)} / {customer.contributionFrequency}</p>
            <p className="text-xs text-slate-400 mt-1">{customer.email} · {customer.phone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-start gap-4">
            <MonthlyTargetRing saved={monthSaved} target={customer.monthlyTarget} />
            <div className="mt-2">
              <p className="text-xs text-slate-500">Monthly Target</p>
              {editing ? (
                <div className="flex gap-2 mt-1">
                  <Input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} className="h-8 w-24 text-sm" />
                  <Button size="sm" onClick={saveTarget} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8">Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-8">✕</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono font-bold">{naira(customer.monthlyTarget)}</p>
                  <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:underline">edit</button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="contributions">Contributions ({contributions.length})</TabsTrigger>
          <TabsTrigger value="cards">Savings Cards ({cards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No payment submissions yet</div>
              ) : (
                <div className="divide-y">
                  {payments.map((p) => (
                    <Link key={p.id} href={`/admin/payments/${p.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{naira(p.totalAmount ?? p.amount ?? 0)}</p>
                        <p className="text-xs text-slate-400">{p.cardAllocations ? p.cardAllocations.map((a) => a.cardName).join(", ") : `${p.periodsCount ?? 0} period${(p.periodsCount ?? 0) !== 1 ? "s" : ""} · ${p.frequency ?? ""}`}</p>
                      </div>
                      <PaymentStatusBadge status={p.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {contributions.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No confirmed contributions yet</div>
              ) : (
                <div className="divide-y">
                  {contributions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-mono font-medium">{c.period}</p>
                        <p className="text-xs text-slate-400">{c.frequency}</p>
                      </div>
                      <p className="font-mono font-semibold text-emerald-600">{naira(c.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards" className="mt-4">
          {cards.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-400">No savings cards yet</CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {cards.map((c) => (
                <Link key={c.id} href={`/admin/cards/${c.id}`}>
                  <Card className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm truncate">{c.cardName}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">{c.category}</span>
                            {c.migrated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 shrink-0">migrated</span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {naira(c.dailyAmount)}/day · {c.daysMarked} days marked
                            {c.firstPeriod ? ` · ${c.firstPeriod} → ${c.lastPeriod}` : ""}
                          </p>
                          {c.withdrawn > 0 && (
                            <p className="text-xs text-red-400 mt-0.5">Withdrawn: {naira(c.withdrawn)}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-mono font-bold text-emerald-600">{naira(c.balance)}</p>
                          <p className="text-[10px] text-slate-400">balance</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              <div className="flex items-center justify-between pt-1 px-1">
                <p className="text-xs text-slate-500">Total across {cards.length} card{cards.length !== 1 ? "s" : ""}</p>
                <p className="font-mono font-bold text-emerald-600">{naira(cardBalanceTotal)}</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}