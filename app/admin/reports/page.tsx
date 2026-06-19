"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function ReportsPage() {
  const { idToken } = useAuth();
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);

  async function generateMonthlyReport() {
    if (!idToken) return;
    setLoadingMonthly(true);
    try {
      const res = await fetch("/api/v1/reports/monthly", { headers: { Authorization: `Bearer ${idToken}` } });
      const json = await res.json();
      if (json.success) {
        window.open(json.data.reportUrl, "_blank");
        toast.success("Monthly report generated");
      } else {
        toast.error(json.error?.message ?? "Failed to generate report");
      }
    } finally {
      setLoadingMonthly(false); }
  }

  async function exportCsv() {
    if (!idToken) return;
    setLoadingCsv(true);
    try {
      const res = await fetch("/api/v1/reports/export/csv", { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) { toast.error("Export failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contributions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } finally {
      setLoadingCsv(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Reports</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly PDF Report</CardTitle>
          <p className="text-sm text-slate-500">
            Generate a comprehensive monthly report including collections, customer breakdown,
            defaulters, and withdrawal log.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={generateMonthlyReport}
            disabled={loadingMonthly}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loadingMonthly ? "Generating PDF…" : "📄 Generate Monthly Report"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Contributions CSV</CardTitle>
          <p className="text-sm text-slate-500">
            Download all confirmed contributions as a spreadsheet.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportCsv}
            disabled={loadingCsv}
            variant="outline"
          >
            {loadingCsv ? "Exporting…" : "⬇ Export CSV"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}