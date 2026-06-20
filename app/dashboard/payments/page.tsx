"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { PaymentSubmission } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function MyPaymentsPage() {
  const { idToken } = useAuth();
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    fetch("/api/v1/payments/me", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((j) => j.success && setPayments(j.data.payments))
      .finally(() => setLoading(false));
  }, [idToken]);

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">My Payments</h2>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-3xl mb-3">💳</p>
              <p className="text-slate-400 font-medium">No payments yet</p>
              <Link href="/dashboard/pay">
                <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">Make your first payment</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {payments.map((p) => (
                <div key={p.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-mono font-bold text-lg">{naira(p.totalAmount ?? p.amount ?? 0)}</p>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>{p.periodsCount ?? p.cardAllocations?.length ?? 0} period{(p.periodsCount ?? p.cardAllocations?.length ?? 0) !== 1 ? "s" : ""}{p.frequency ? ` · ${p.frequency}` : ""}</span>
                    <span>{(p.submittedAt as unknown as { toDate: () => Date })?.toDate?.()?.toLocaleDateString()}</span>
                  </div>
                  {p.rejectionReason && (
                    <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                      Rejection reason: {p.rejectionReason}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {p.cardAllocations ? (
                      p.cardAllocations.map((a) => (
                        <span key={a.cardId} className="text-xs bg-gold-500/10 text-gold-400 border border-gold-500/20 px-2 py-0.5 rounded font-mono">
                          {a.cardName}: {naira(a.amount)}
                        </span>
                      ))
                    ) : (p.periods ?? []).slice(0, 10).map((period) => (
                      <span key={period} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-mono">
                        {period}
                      </span>
                    ))}
                    {!p.cardAllocations && (p.periods ?? []).length > 10 && (
                      <span className="text-xs text-slate-400">+{(p.periods ?? []).length - 10} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}