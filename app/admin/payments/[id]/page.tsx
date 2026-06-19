"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SubmissionDetailModal } from "@/components/admin/SubmissionDetailModal";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PaymentSubmission } from "@/types";

export default function PaymentDetailPage({ params }: { params: { id: string } }) {
  const { idToken } = useAuth();
  const router = useRouter();
  const [submission, setSubmission] = useState<PaymentSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    fetch(`/api/v1/payments/${params.id}`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((j) => j.success && setSubmission(j.data.payment))
      .finally(() => setLoading(false));
  }, [idToken, params.id]);

  async function handleConfirm(id: string) {
    const res = await fetch(`/api/v1/payments/${id}/confirm`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const json = await res.json();
    if (json.success) { toast.success("Payment confirmed"); router.push("/admin/payments"); }
    else toast.error(json.error?.message ?? "Failed");
  }

  async function handleReject(id: string, reason: string) {
    const res = await fetch(`/api/v1/payments/${id}/reject`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Payment rejected"); router.push("/admin/payments"); }
    else toast.error(json.error?.message ?? "Failed");
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>;
  if (!submission) return <p className="text-slate-400">Payment not found.</p>;

  return (
    <SubmissionDetailModal
      submission={submission}
      open={true}
      onClose={() => router.push("/admin/payments")}
      onConfirm={handleConfirm}
      onReject={handleReject}
    />
  );
}