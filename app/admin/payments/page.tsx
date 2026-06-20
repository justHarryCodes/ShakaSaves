"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatusBadge } from "@/components/shared/PaymentStatusBadge";
import { SubmissionDetailModal } from "@/components/admin/SubmissionDetailModal";
import { toast } from "sonner";
import type { PaymentSubmission, PaymentStatus } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

function PaymentsTable({
  payments,
  loading,
  onSelect,
}: {
  payments: PaymentSubmission[];
  loading: boolean;
  onSelect: (p: PaymentSubmission) => void;
}) {
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }
  if (payments.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-3xl mb-2">✓</p>
        <p className="text-slate-400 font-medium">Nothing here — all caught up</p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50 dark:bg-slate-900">
          <TableHead>Customer</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Cards / Periods</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Proof</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => {
          const isNew = !!(p.cardAllocations?.length);
          const amount = p.totalAmount ?? p.amount ?? 0;
          return (
            <TableRow key={p.id} className="cursor-pointer hover:bg-white/[0.02]" onClick={() => onSelect(p)}>
              <TableCell className="font-medium text-white">{p.customerName}</TableCell>
              <TableCell className="font-mono font-semibold text-gold-400">{naira(amount)}</TableCell>
              <TableCell className="text-zinc-400 text-sm">
                {isNew
                  ? p.cardAllocations!.map((a) => a.cardName).join(", ")
                  : `${p.periodsCount ?? 0} × ${p.frequency ?? ""}`}
              </TableCell>
              <TableCell className="text-sm text-zinc-500">
                {(p.submittedAt as unknown as { toDate: () => Date })?.toDate?.()?.toLocaleDateString() ?? "—"}
              </TableCell>
              <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
              <TableCell>
                {!isNew && p.proofImageUrl ? (
                  <a href={p.proofImageUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                    Proof
                  </a>
                ) : <span className="text-xs text-zinc-600">—</span>}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function PaymentsPage() {
  const { idToken } = useAuth();
  const [byStatus, setByStatus] = useState<Record<PaymentStatus, PaymentSubmission[]>>({
    pending: [], confirmed: [], rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PaymentSubmission | null>(null);

  const fetchAll = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const [pending, confirmed, rejected] = await Promise.all(
        (["pending", "confirmed", "rejected"] as PaymentStatus[]).map((s) =>
          fetch(`/api/v1/payments?status=${s}&limit=50`, { headers: { Authorization: `Bearer ${idToken}` } })
            .then((r) => r.json())
            .then((j) => (j.success ? j.data.payments : []))
        )
      );
      setByStatus({ pending, confirmed, rejected });
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleConfirm(id: string, overrides: Record<string, number> = {}) {
    const res = await fetch(`/api/v1/payments/${id}/confirm`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Payment confirmed"); await fetchAll(); }
    else toast.error(json.error?.message ?? "Failed");
  }

  async function handleReject(id: string, reason: string) {
    const res = await fetch(`/api/v1/payments/${id}/reject`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Payment rejected"); await fetchAll(); }
    else toast.error(json.error?.message ?? "Failed");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payment Submissions</h2>
        <p className="text-slate-500 text-sm mt-1">{byStatus.pending.length} pending review</p>
      </div>

      <Card className="shadow-sm">
        <Tabs defaultValue="pending">
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="pending">Pending ({byStatus.pending.length})</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed ({byStatus.confirmed.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({byStatus.rejected.length})</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {(["pending", "confirmed", "rejected"] as PaymentStatus[]).map((status) => (
              <TabsContent key={status} value={status}>
                <PaymentsTable
                  payments={byStatus[status]}
                  loading={loading}
                  onSelect={setSelected}
                />
              </TabsContent>
            ))}
          </CardContent>
        </Tabs>
      </Card>

      <SubmissionDetailModal
        submission={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    </div>
  );
}