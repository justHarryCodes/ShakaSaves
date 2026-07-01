"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import type { Customer } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function CustomersPage() {
  const { idToken } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!idToken) return;
    fetch("/api/v1/customers?limit=100", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((j) => j.success && setCustomers(j.data.customers))
      .finally(() => setLoading(false));
  }, [idToken]);

  const filtered = customers.filter((c) =>
    search
      ? c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Customers</h2>
          <p className="text-slate-500 text-sm mt-1">{customers.length} total</p>
        </div>
        <Link href="/admin/customers/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">+ Add customer</Button>
        </Link>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-3xl mb-3">👥</p>
              <p className="text-slate-400 font-medium">No customers found</p>
              <Link href="/admin/customers/new">
                <Button variant="outline" className="mt-4">Add your first customer</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.fullName}</TableCell>
                    <TableCell className="text-sm text-slate-500">{c.email}</TableCell>
                    <TableCell className="text-sm">
                      {naira(c.contributionAmount)} / {c.contributionFrequency}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-emerald-600">
                      {naira(c.currentBalance)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={c.status === "active" ? "text-emerald-600 border-emerald-200" : "text-slate-400"}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/customers/${c.id}`} className="text-sm text-blue-600 hover:underline">
                        View →
                      </Link>
                    </TableCell>
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