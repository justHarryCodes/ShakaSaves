"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Download } from "lucide-react";

export default function ReportsPage() {
  const { idToken } = useAuth();
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

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
      setLoadingMonthly(false);
    }
  }

  async function exportCsv() {
    if (!idToken) return;
    setLoadingCsv(true);
    try {
      const res = await fetch("/api/v1/reports/export/csv", { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) { toast.error("Export failed"); return; }
      const blob = await res.blob();
      triggerDownload(blob, `contributions-${today()}.csv`);
      toast.success("CSV exported");
    } finally {
      setLoadingCsv(false);
    }
  }

  async function exportExcel() {
    if (!idToken) return;
    setLoadingExcel(true);
    try {
      const res = await fetch("/api/v1/admin/export", { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      triggerDownload(blob, `shaka-saves-export-${today()}.xlsx`);
      toast.success("Excel exported — 4 sheets: Customers, Deposits, Withdrawals, Cards");
    } finally {
      setLoadingExcel(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-white">Reports</h2>

      {/* Excel export — primary */}
      <Card className="border-gold-500/20" style={{ background: "rgba(212,175,55,0.04)" }}>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-gold-500/20"
              style={{ background: "rgba(212,175,55,0.1)" }}>
              <FileSpreadsheet size={18} className="text-gold-400" />
            </div>
            <div>
              <CardTitle className="text-base text-white">Full Data Export (Excel)</CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">
                Downloads a .xlsx workbook with 4 sheets — Customers, Deposits, Withdrawals, Cards.
                Includes all status changes, reviewer names, and timestamps.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportExcel}
            disabled={loadingExcel}
            className="bg-gold-500 hover:bg-gold-400 text-black font-semibold h-9 px-4 rounded-xl disabled:opacity-50"
          >
            <Download size={14} className="mr-2" />
            {loadingExcel ? "Building spreadsheet…" : "Export to Excel"}
          </Button>
        </CardContent>
      </Card>

      <Separator className="bg-white/[0.05]" />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <FileText size={18} className="text-zinc-400" />
            <CardTitle className="text-base text-white">Monthly PDF Report</CardTitle>
          </div>
          <p className="text-sm text-zinc-500">
            Comprehensive monthly report including collections, customer breakdown, defaulters, and withdrawal log.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={generateMonthlyReport}
            disabled={loadingMonthly}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4 rounded-xl disabled:opacity-50"
          >
            {loadingMonthly ? "Generating PDF…" : "Generate Monthly Report"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-white">Export Contributions CSV</CardTitle>
          <p className="text-sm text-zinc-500">Download all confirmed contributions as a CSV spreadsheet.</p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportCsv}
            disabled={loadingCsv}
            variant="outline"
            className="h-9 px-4 rounded-xl border-white/10 text-zinc-300 hover:text-white disabled:opacity-50"
          >
            {loadingCsv ? "Exporting…" : "Export CSV"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
