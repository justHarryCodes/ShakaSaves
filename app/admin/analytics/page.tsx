"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function AnalyticsPage() {
  const { idToken } = useAuth();
  const [growth, setGrowth] = useState<{ month: string; newCustomers: number; totalSavings: number }[]>([]);
  const [collectionRate, setCollectionRate] = useState<{ date: string; payers: number; rate: number }[]>([]);
  const [defaulters, setDefaulters] = useState<{ id: string; fullName: string; contributionFrequency: string; currentBalance: number }[]>([]);
  const [targets, setTargets] = useState<{ customerId: string; fullName: string; monthlyTarget: number; savedThisMonth: number; achievementPct: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    Promise.all([
      fetch("/api/v1/analytics/growth", { headers: { Authorization: `Bearer ${idToken}` } }).then((r) => r.json()).then((j) => j.success && setGrowth(j.data.data)),
      fetch("/api/v1/analytics/collection-rate", { headers: { Authorization: `Bearer ${idToken}` } }).then((r) => r.json()).then((j) => j.success && setCollectionRate(j.data.data)),
      fetch("/api/v1/analytics/defaulters?days=30", { headers: { Authorization: `Bearer ${idToken}` } }).then((r) => r.json()).then((j) => j.success && setDefaulters(j.data.defaulters)),
      fetch("/api/v1/analytics/target-achievement", { headers: { Authorization: `Bearer ${idToken}` } }).then((r) => r.json()).then((j) => j.success && setTargets(j.data.achievements)),
    ]).finally(() => setLoading(false));
  }, [idToken]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics</h2>

      {/* Collection Rate */}
      <Card>
        <CardHeader><CardTitle className="text-base">Collection Rate (Last 30 Days)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={collectionRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, "Rate"]} />
                <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Savings Growth */}
        <Card>
          <CardHeader><CardTitle className="text-base">Savings Growth</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [naira(Number(v)), "Savings"]} />
                  <Area type="monotone" dataKey="totalSavings" stroke="#10B981" fill="#10B98122" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Customer Growth */}
        <Card>
          <CardHeader><CardTitle className="text-base">New Customers / Month</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="newCustomers" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Target Achievement */}
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Target Achievement</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-48 w-full" /> : targets.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {targets.sort((a, b) => b.achievementPct - a.achievementPct).map((t) => (
                <div key={t.customerId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{t.fullName}</span>
                    <span className="text-slate-500 font-mono">{naira(t.savedThisMonth)} / {naira(t.monthlyTarget)}</span>
                    <span className={`font-bold ${t.achievementPct >= 100 ? "text-emerald-600" : t.achievementPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                      {t.achievementPct}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${t.achievementPct >= 100 ? "bg-emerald-500" : t.achievementPct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min(t.achievementPct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Defaulters */}
      <Card>
        <CardHeader><CardTitle className="text-base">Defaulters (No payment in 30 days)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-6"><Skeleton className="h-24 w-full" /></div> : defaulters.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No defaulters — everyone is on track!</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900">
                  <TableHead>Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaulters.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-red-600">{d.fullName}</TableCell>
                    <TableCell className="capitalize">{d.contributionFrequency}</TableCell>
                    <TableCell className="font-mono">{naira(d.currentBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}