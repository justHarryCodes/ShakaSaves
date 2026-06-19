"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BalanceCard } from "@/components/shared/BalanceCard";
import { MonthlyTargetRing } from "@/components/shared/MonthlyTargetRing";
import { SavingsCard } from "@/components/shared/SavingsCard";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Customer, PaymentSubmission, SavingsCard as SavingsCardType, Contribution } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function CustomerDashboard() {
  const { idToken, user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [recentPayments, setRecentPayments] = useState<PaymentSubmission[]>([]);
  const [card, setCard] = useState<SavingsCardType | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;

    async function load() {
      try {
        // Fetch customer profile and payments in parallel
        const [profileRes, paymentsRes] = await Promise.all([
          fetch("/api/v1/auth/verify", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } }),
          fetch("/api/v1/payments/me", { headers: { Authorization: `Bearer ${idToken}` } }),
        ]);

        const [profileJson, paymentsJson] = await Promise.all([profileRes.json(), paymentsRes.json()]);
        if (!profileJson.success) return;

        if (paymentsJson.success) {
          const payments = paymentsJson.data.payments as PaymentSubmission[];
          setRecentPayments(payments.slice(0, 5));

          if (payments.length > 0) {
            const customerId = payments[0].customerId;
            const [custRes, cardRes, contribRes] = await Promise.all([
              fetch(`/api/v1/customers/${customerId}`, { headers: { Authorization: `Bearer ${idToken}` } }),
              fetch(`/api/v1/cards/${customerId}`, { headers: { Authorization: `Bearer ${idToken}` } }),
              fetch(`/api/v1/contributions/${customerId}`, { headers: { Authorization: `Bearer ${idToken}` } }),
            ]);
            const [custJson, cardJson, contribJson] = await Promise.all([custRes.json(), cardRes.json(), contribRes.json()]);
            if (custJson.success) setCustomer(custJson.data.customer);
            if (cardJson.success) setCard(cardJson.data.card);
            if (contribJson.success) setContributions(contribJson.data.contributions);
          }
        }
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [idToken]);

  const now = new Date();
  const monthSaved = contributions
    .filter((c) => {
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return c.period.startsWith(prefix);
    })
    .reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Welcome back!</h2>
        <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BalanceCard
          currentBalance={customer?.currentBalance ?? 0}
          pendingBalance={customer?.pendingBalance ?? 0}
          loading={loading}
        />
        <Card className="shadow-sm">
          <CardContent className="pt-6 flex items-center justify-center">
            {loading ? (
              <Skeleton className="h-32 w-32 rounded-full" />
            ) : (
              <MonthlyTargetRing saved={monthSaved} target={customer?.monthlyTarget ?? 0} />
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-[#0F172A] border-0">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Your Plan</p>
            {loading ? (
              <Skeleton className="h-6 w-32 bg-slate-700" />
            ) : (
              <>
                <p className="text-xl font-bold text-white font-mono">
                  {naira(customer?.contributionAmount ?? 0)}
                </p>
                <p className="text-slate-400 text-sm capitalize">per {customer?.contributionFrequency}</p>
                <Link href="/dashboard/pay" className="mt-3 block">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2">
                    Make Payment →
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Savings Card thumbnail */}
      {(card || loading) && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Your Savings Card</CardTitle>
            <Link href="/dashboard/card" className="text-sm text-blue-600 hover:underline">View full card →</Link>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <SavingsCard cardImageUrl={card?.cardImageUrl ?? null} customerName={customer?.fullName ?? ""} loading={loading} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Payments</CardTitle>
          <Link href="/dashboard/payments" className="text-sm text-blue-600 hover:underline">View all →</Link>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentPayments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-2xl mb-2">💸</p>
              <p className="text-slate-400 font-medium">No payments yet</p>
              <Link href="/dashboard/pay">
                <Button variant="outline" className="mt-3">Make your first payment</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold font-mono">{naira(p.amount)}</p>
                    <p className="text-xs text-slate-400">{p.periodsCount} period{p.periodsCount !== 1 ? "s" : ""}</p>
                  </div>
                  <PaymentStatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}