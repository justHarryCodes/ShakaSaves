"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import Link from "next/link";
import type { PaymentSubmission } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

interface Overview {
  totalSavingsUnderManagement: number;
  activeCustomers: number;
  pendingPayments: number;
  monthlyCollections: number;
  collectionRate: number;
}

export default function AdminDashboard() {
  const { idToken } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pending, setPending] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    Promise.all([
      fetch("/api/v1/analytics/overview", { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json()).then((j) => j.success && setOverview(j.data)),
      fetch("/api/v1/payments?status=pending&limit=5", { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json()).then((j) => j.success && setPending(j.data.payments)),
    ]).finally(() => setLoading(false));
  }, [idToken]);

  const kpis = overview
    ? [
        { label: "Savings Under Management", value: naira(overview.totalSavingsUnderManagement), color: "text-emerald-600" },
        { label: "Active Customers", value: overview.activeCustomers.toString(), color: "text-blue-600" },
        { label: "Pending Payments", value: overview.pendingPayments.toString(), color: "text-amber-600" },
        { label: "This Month's Collections", value: naira(overview.monthlyCollections), color: "text-purple-600" },
        { label: "Collection Rate", value: `${overview.collectionRate}%`, color: "text-slate-700" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">Overview of your Ajo collection</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-7 w-32" />
                </CardContent>
              </Card>
            ))
          : kpis.map((kpi) => (
              <Card key={kpi.label} className="shadow-sm">
                <CardContent className="pt-6">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{kpi.label}</p>
                  <p className={`text-2xl font-mono font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Recent pending payments */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Pending Payments</CardTitle>
          <Link href="/admin/payments" className="text-sm text-blue-600 hover:underline">View all →</Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-2xl mb-2">✓</p>
              <p className="text-sm text-slate-400 font-medium">No pending payments — you&apos;re all caught up</p>
            </div>
          ) : (
            <div className="divide-y">
              {pending.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/payments/${p.id}`}
                  className="flex items-center justify-between py-3 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{p.customerName}</p>
                    <p className="text-xs text-slate-400">{p.periodsCount} period{p.periodsCount !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold">{naira(p.amount)}</span>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}