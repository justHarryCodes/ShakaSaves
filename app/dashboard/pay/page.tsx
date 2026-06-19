"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PeriodSelector } from "@/components/shared/PeriodSelector";
import { PaymentProofUpload } from "@/components/shared/PaymentProofUpload";
import { toast } from "sonner";
import type { Customer, PaymentSubmission } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

function generateUUID(): string {
  return crypto.randomUUID();
}

interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export default function PayPage() {
  const { idToken } = useAuth();
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [confirmedPeriods, setConfirmedPeriods] = useState<string[]>([]);
  const [pendingPeriods, setPendingPeriods] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!idToken) return;

    async function load() {
      // Load bank details + own customer profile
      const [settingsRes, paymentsRes] = await Promise.all([
        fetch("/api/v1/settings", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/v1/payments/me", { headers: { Authorization: `Bearer ${idToken}` } }),
      ]);

      const [settingsJson, paymentsJson] = await Promise.all([settingsRes.json(), paymentsRes.json()]);

      if (settingsJson.success) setBankDetails(settingsJson.data.settings);

      if (paymentsJson.success) {
        const payments = paymentsJson.data.payments as PaymentSubmission[];
        const confirmed = payments.filter((p) => p.status === "confirmed").flatMap((p) => p.periods);
        const pending = payments.filter((p) => p.status === "pending").flatMap((p) => p.periods);
        setConfirmedPeriods(confirmed);
        setPendingPeriods(pending);

        if (payments.length > 0) {
          const custId = payments[0].customerId;
          const custRes = await fetch(`/api/v1/customers/${custId}`, { headers: { Authorization: `Bearer ${idToken}` } });
          const custJson = await custRes.json();
          if (custJson.success) setCustomer(custJson.data.customer);
        }
      }
      setLoading(false);
    }
    load();
  }, [idToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken || !proofFile || selectedPeriods.length === 0 || !customer) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("proof", proofFile);
      formData.append("periods", JSON.stringify(selectedPeriods));
      formData.append("frequency", customer.contributionFrequency);
      if (note) formData.append("note", note);

      const idempotencyKey = generateUUID();
      const res = await fetch("/api/v1/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Idempotency-Key": idempotencyKey },
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
        toast.success("Payment submitted! The admin will review it shortly.");
      } else {
        toast.error(json.error?.message ?? "Submission failed");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Payment Submitted!</h2>
        <p className="text-slate-500 mb-6">The admin will review your payment proof and confirm it shortly. You&apos;ll receive a notification when it&apos;s confirmed.</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => { setSubmitted(false); setSelectedPeriods([]); setProofFile(null); setNote(""); }} variant="outline">
            Submit another
          </Button>
          <a href="/dashboard/payments"><Button className="bg-emerald-600 hover:bg-emerald-700 text-white">View my payments</Button></a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold">Make a Payment</h2>

      {/* Bank details */}
      <Card className="bg-[#0F172A] border-0 text-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-400 uppercase tracking-wide">Transfer to this account</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !bankDetails ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-48 bg-slate-700" />
              <Skeleton className="h-5 w-32 bg-slate-700" />
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">{bankDetails.bankName}</p>
              <p className="text-3xl font-mono font-bold tracking-widest text-emerald-400">
                {bankDetails.accountNumber}
              </p>
              <p className="text-sm text-slate-300">{bankDetails.accountName}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Period selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select periods to pay for</CardTitle>
            {customer && (
              <p className="text-sm text-slate-500">
                {naira(customer.contributionAmount)} per {customer.contributionFrequency}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : customer ? (
              <PeriodSelector
                frequency={customer.contributionFrequency}
                contributionAmount={customer.contributionAmount}
                confirmedPeriods={confirmedPeriods}
                pendingPeriods={pendingPeriods}
                selected={selectedPeriods}
                onChange={setSelectedPeriods}
              />
            ) : (
              <p className="text-slate-400">Unable to load your contribution plan. Please contact support.</p>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Proof upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload payment proof</CardTitle>
            <p className="text-sm text-slate-500">Screenshot of your bank transfer receipt</p>
          </CardHeader>
          <CardContent>
            <PaymentProofUpload onFileSelect={setProofFile} selectedFile={proofFile} />
          </CardContent>
        </Card>

        {/* Note */}
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Textarea
            placeholder="Any note for the admin…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
          />
        </div>

        <Button
          type="submit"
          disabled={submitting || !proofFile || selectedPeriods.length === 0}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base h-12 font-semibold"
        >
          {submitting ? "Submitting…" : `I have sent this payment${selectedPeriods.length > 0 ? ` — ${naira(selectedPeriods.length * (customer?.contributionAmount ?? 0))}` : ""}`}
        </Button>
      </form>
    </div>
  );
}