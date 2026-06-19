"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SavingsCard } from "@/components/shared/SavingsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { PaymentSubmission, SavingsCard as SavingsCardType } from "@/types";

function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

export default function CardPage() {
  const { idToken } = useAuth();
  const [card, setCard] = useState<SavingsCardType | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    fetch("/api/v1/payments/me", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then(async (j) => {
        if (j.success && j.data.payments.length > 0) {
          const cid = (j.data.payments[0] as PaymentSubmission).customerId;
          setCustomerId(cid);
          const [cardRes, custRes] = await Promise.all([
            fetch(`/api/v1/cards/${cid}`, { headers: { Authorization: `Bearer ${idToken}` } }),
            fetch(`/api/v1/customers/${cid}`, { headers: { Authorization: `Bearer ${idToken}` } }),
          ]);
          const [cardJson, custJson] = await Promise.all([cardRes.json(), custRes.json()]);
          if (cardJson.success) setCard(cardJson.data.card);
          if (custJson.success) setCustomerName(custJson.data.customer.fullName);
        }
        setLoading(false);
      });
  }, [idToken]);

  async function handleDownload() {
    if (!idToken || !customerId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/v1/cards/${customerId}/download`, { headers: { Authorization: `Bearer ${idToken}` } });
      const json = await res.json();
      if (json.success) {
        window.open(json.data.downloadUrl, "_blank");
      } else {
        toast.error("Download failed");
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Savings Card</h2>
        {card && (
          <Button onClick={handleDownload} disabled={downloading} variant="outline">
            {downloading ? "Preparing…" : "⬇ Download PNG"}
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="w-full aspect-[900/560] rounded-2xl" />
      ) : (
        <SavingsCard cardImageUrl={card?.cardImageUrl ?? null} customerName={customerName} />
      )}

      {card && (
        <Card>
          <CardHeader><CardTitle className="text-base">Card Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Current Balance</p>
                <p className="font-mono font-bold text-emerald-600">{naira(card.currentBalance)}</p>
              </div>
              <div>
                <p className="text-slate-500">Periods Confirmed</p>
                <p className="font-bold">{card.tickedPeriods.length}</p>
              </div>
              <div>
                <p className="text-slate-500">Frequency</p>
                <p className="capitalize font-medium">{card.frequency}</p>
              </div>
              <div>
                <p className="text-slate-500">Monthly Target</p>
                <p className="font-mono font-medium">{naira(card.monthlyTarget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}