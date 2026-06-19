"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function naira(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

interface BalanceCardProps {
  currentBalance: number;
  pendingBalance: number;
  loading?: boolean;
}

export function BalanceCard({ currentBalance, pendingBalance, loading }: BalanceCardProps) {
  if (loading) {
    return (
      <Card className="bg-[#0F172A] text-white border-0">
        <CardHeader>
          <Skeleton className="h-4 w-24 bg-slate-700" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-40 bg-slate-700" />
          <Skeleton className="h-4 w-32 bg-slate-700 mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0F172A] text-white border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Confirmed Balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-mono font-bold text-emerald-400">{naira(currentBalance)}</p>
        <p className="text-sm text-slate-400 mt-2">
          Pending:{" "}
          <span className="font-mono text-amber-400 font-medium">{naira(pendingBalance)}</span>
        </p>
      </CardContent>
    </Card>
  );
}
