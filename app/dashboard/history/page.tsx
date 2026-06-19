"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Contribution } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function HistoryPage() {
  const { idToken } = useAuth();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    fetch("/api/v1/contributions/me", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((j) => j.success && setContributions(j.data.contributions))
      .finally(() => setLoading(false));
  }, [idToken]);

  const totalSaved = contributions.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Contribution History</h2>
        <div className="text-right">
          <p className="text-xs text-slate-500">Total saved</p>
          <p className="font-mono font-bold text-emerald-600">{naira(totalSaved)}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : contributions.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-3xl mb-3">🕐</p>
              <p className="text-slate-400 font-medium">No confirmed contributions yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {contributions.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-mono text-sm font-semibold">{c.period}</p>
                    <p className="text-xs text-slate-400 capitalize">{c.frequency}</p>
                  </div>
                  <p className="font-mono font-bold text-emerald-600">{naira(c.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}