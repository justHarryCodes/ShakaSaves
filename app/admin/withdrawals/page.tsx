"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WithdrawalStatusBadge } from "@/components/shared/WithdrawalStatusBadge";
import { toast } from "sonner";
import type { Withdrawal, WithdrawalStatus } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function WithdrawalsPage() {
  const { idToken } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<Withdrawal | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    const res = await fetch("/api/v1/withdrawals?limit=100", { headers: { Authorization: `Bearer ${idToken}` } });
    const json = await res.json();
    if (json.success) setWithdrawals(json.data.withdrawals);
    setLoading(false);
  }, [idToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function action(id: string, endpoint: string, body?: object) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/withdrawals/${id}/${endpoint}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (json.success) { toast.success("Done"); await fetchAll(); }
      else toast.error(json.error?.message ?? "Failed");
    } finally { setActionLoading(false); }
  }

  const byStatus = (status: WithdrawalStatus) => withdrawals.filter((w) => w.status === status);

  function WithdrawalTable({ items }: { items: Withdrawal[] }) {
    if (loading) return <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
    if (items.length === 0) return <div className="py-12 text-center text-slate-400">None here</div>;

    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-900">
            <TableHead>Customer ID</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((w) => (
            <TableRow key={w.id}>
              <TableCell className="font-mono text-xs">{w.customerId.slice(0, 10)}…</TableCell>
              <TableCell className="font-mono font-bold text-emerald-600">{naira(w.amountRequested)}</TableCell>
              <TableCell className="text-sm text-slate-500">
                {(w.requestedAt as unknown as { toDate: () => Date })?.toDate?.()?.toLocaleDateString() ?? "—"}
              </TableCell>
              <TableCell><WithdrawalStatusBadge status={w.status} /></TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {w.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => action(w.id, "approve")} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => { setRejecting(w); setReason(""); }} className="h-7 text-xs text-red-600 border-red-200">Reject</Button>
                    </>
                  )}
                  {w.status === "approved" && (
                    <Button size="sm" onClick={() => action(w.id, "mark-paid")} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs">Mark Paid</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Withdrawals</h2>
      <Card className="shadow-sm">
        <Tabs defaultValue="pending">
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({byStatus("approved").length})</TabsTrigger>
              <TabsTrigger value="paid">Paid ({byStatus("paid").length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({byStatus("rejected").length})</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {(["pending", "approved", "paid", "rejected"] as WithdrawalStatus[]).map((status) => (
              <TabsContent key={status} value={status}>
                <WithdrawalTable items={byStatus(status)} />
              </TabsContent>
            ))}
          </CardContent>
        </Tabs>
      </Card>

      <Dialog open={!!rejecting} onOpenChange={() => setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Provide a reason for rejecting this withdrawal of <strong>{rejecting ? naira(rejecting.amountRequested) : ""}</strong>.</p>
            <Textarea placeholder="Reason…" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button variant="destructive" disabled={!reason.trim() || actionLoading} onClick={async () => { if (rejecting) { await action(rejecting.id, "reject", { rejectionReason: reason }); setRejecting(null); } }}>
                Confirm Rejection
              </Button>
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}