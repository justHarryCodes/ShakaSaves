"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { WithdrawalStatusBadge } from "@/components/shared/WithdrawalStatusBadge";
import { toast } from "sonner";
import type { Customer, Withdrawal, PaymentSubmission } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function WithdrawPage() {
  const { idToken } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    fetch("/api/v1/payments/me", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then(async (j) => {
        if (j.success && j.data.payments.length > 0) {
          const cid = (j.data.payments[0] as PaymentSubmission).customerId;
          const [custRes, withdrawRes] = await Promise.all([
            fetch(`/api/v1/customers/${cid}`, { headers: { Authorization: `Bearer ${idToken}` } }),
            fetch("/api/v1/withdrawals/me", { headers: { Authorization: `Bearer ${idToken}` } }),
          ]);
          const [custJson, withdrawJson] = await Promise.all([custRes.json(), withdrawRes.json()]);
          if (custJson.success) setCustomer(custJson.data.customer);
          if (withdrawJson.success) setWithdrawals(withdrawJson.data.withdrawals);
        }
        setLoading(false);
      });
  }, [idToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/withdrawals", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amountRequested: Number(amount), note: note || null }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Withdrawal request submitted!");
        setAmount("");
        setNote("");
        // Reload withdrawals
        const res2 = await fetch("/api/v1/withdrawals/me", { headers: { Authorization: `Bearer ${idToken}` } });
        const j2 = await res2.json();
        if (j2.success) setWithdrawals(j2.data.withdrawals);
      } else {
        toast.error(json.error?.message ?? "Request failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasPendingWithdrawal = withdrawals.some((w) => w.status === "pending");

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Withdraw Savings</h2>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <Card className="bg-[#0F172A] border-0 text-white">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Available Balance</p>
              <p className="text-4xl font-mono font-bold text-emerald-400 mt-1">{naira(customer?.currentBalance ?? 0)}</p>
              <p className="text-xs text-slate-500 mt-2">
                Minimum withdrawal after {customer?.minimumWithdrawalDays ?? 30} days of savings
              </p>
            </CardContent>
          </Card>

          {hasPendingWithdrawal ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-amber-600 font-medium text-sm">⏳ You have a pending withdrawal request. Please wait for it to be processed before submitting a new one.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Request a Withdrawal</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Amount (₦)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={customer?.currentBalance ?? 0}
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="font-mono text-lg"
                    />
                    <p className="text-xs text-slate-400">Max: {naira(customer?.currentBalance ?? 0)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Textarea placeholder="Reason for withdrawal…" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                  </div>
                  <Button type="submit" disabled={submitting || !amount} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    {submitting ? "Submitting…" : "Request withdrawal"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Withdrawal history */}
          {withdrawals.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Withdrawal History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="font-mono font-bold">{naira(w.amountRequested)}</p>
                        <p className="text-xs text-slate-400">
                          {(w.requestedAt as unknown as { toDate: () => Date })?.toDate?.()?.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <WithdrawalStatusBadge status={w.status} />
                        {w.rejectionReason && (
                          <p className="text-xs text-red-500">{w.rejectionReason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}