"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Table2, RefreshCw, Download } from "lucide-react";

type MigrationStatus = "not_submitted" | "pending" | "approved" | "rejected";

interface CardTotals {
  totalSavings: number;
  totalWtd: number;
  totalBal: number;
  totalCommission: number;
}

interface RecordRow {
  migrationCode: string;
  primaryName: string;
  subAccountCount: number;
  categories: string[];
  totals: CardTotals;
  migrationStatus: MigrationStatus;
  requestId: string | null;
  customerId: string | null;
  customerName: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

const STATUS_LABELS: Record<MigrationStatus, string> = {
  not_submitted: "Not Submitted",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_STYLES: Record<MigrationStatus, string> = {
  not_submitted: "bg-zinc-800 text-zinc-400 border-zinc-700",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

const ALL_FILTERS: Array<{ key: MigrationStatus | "all"; label: string }> = [
  { key: "all",          label: "All" },
  { key: "not_submitted",label: "Not Submitted" },
  { key: "pending",      label: "Pending" },
  { key: "approved",     label: "Approved" },
  { key: "rejected",     label: "Rejected" },
];

function fmt(n: number): string {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function AdminRecordsPage() {
  const { idToken } = useAuth();
  const [rows, setRows]       = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<MigrationStatus | "all">("all");
  const [search, setSearch]   = useState("");

  async function fetchRecords() {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/records", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Failed to load records");
      const data = await res.json();
      setRows(data.data.records as RecordRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecords(); }, [idToken]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filter !== "all") r = r.filter((row) => row.migrationStatus === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) =>
        row.migrationCode.toLowerCase().includes(q) ||
        row.primaryName.toLowerCase().includes(q) ||
        (row.customerName ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    const c = { not_submitted: 0, pending: 0, approved: 0, rejected: 0 };
    rows.forEach((r) => { c[r.migrationStatus]++; });
    return c;
  }, [rows]);

  const grandTotals = useMemo(() =>
    filtered.reduce(
      (acc, r) => ({
        savings:    acc.savings    + r.totals.totalSavings,
        wtd:        acc.wtd        + r.totals.totalWtd,
        bal:        acc.bal        + r.totals.totalBal,
        commission: acc.commission + r.totals.totalCommission,
      }),
      { savings: 0, wtd: 0, bal: 0, commission: 0 }
    ), [filtered]);

  function exportCSV() {
    const headers = [
      "Code", "Primary Name", "Sub-accounts", "Categories",
      "Total Savings", "Total Withdrawn", "Net Balance", "Commission",
      "Status", "Customer", "Submitted", "Reviewed",
    ];
    const csvRows = filtered.map((r) => [
      r.migrationCode,
      `"${r.primaryName}"`,
      r.subAccountCount,
      `"${r.categories.join(", ")}"`,
      r.totals.totalSavings.toFixed(2),
      r.totals.totalWtd.toFixed(2),
      r.totals.totalBal.toFixed(2),
      r.totals.totalCommission.toFixed(2),
      STATUS_LABELS[r.migrationStatus],
      `"${r.customerName ?? ""}"`,
      r.submittedAt ? fmtDate(r.submittedAt) : "",
      r.reviewedAt  ? fmtDate(r.reviewedAt)  : "",
    ].join(","));
    const csv  = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "shaka-migration-records.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Table2 size={18} className="text-gold-400" />
            Migration Records
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            All {rows.length} card records from the ShakaSaves migration sheet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecords}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 border border-white/[0.08] hover:bg-white/[0.05] transition-colors disabled:opacity-40"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Not Submitted", count: counts.not_submitted, color: "text-zinc-400" },
          { label: "Pending",       count: counts.pending,       color: "text-amber-400" },
          { label: "Approved",      count: counts.approved,      color: "text-emerald-400" },
          { label: "Rejected",      count: counts.rejected,      color: "text-red-400" },
        ].map(({ label, count, color }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.06] p-3.5"
            style={{ background: "#0D0D0D" }}
          >
            <div className={`text-2xl font-bold font-mono ${color}`}>{count}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div
          className="flex gap-1 p-1 rounded-xl border border-white/[0.06] flex-wrap"
          style={{ background: "#0D0D0D" }}
        >
          {ALL_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === key
                  ? "text-black font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              style={filter === key ? { background: "#D4AF37" } : undefined}
            >
              {label}
              {key !== "all" && (
                <span className="ml-1.5 opacity-60">
                  {counts[key as MigrationStatus]}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, name…"
          className="flex-1 min-w-0 px-3 py-1.5 rounded-xl text-sm text-white placeholder-zinc-600 border border-white/[0.06] bg-[#0D0D0D] outline-none focus:border-gold-500/30 transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
          Loading records…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <div
          className="rounded-xl border border-white/[0.06] overflow-hidden"
          style={{ background: "#0D0D0D" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: "1080px" }}>
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Code", "Primary Name", "Sub-accts",
                    "Categories", "Total Savings", "Total Wtd",
                    "Net Balance", "Commission", "Status",
                    "Customer", "Submitted", "Reviewed",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-zinc-600 text-sm">
                      No records match
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => (
                    <tr
                      key={row.migrationCode}
                      className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                        i % 2 !== 0 ? "bg-white/[0.01]" : ""
                      }`}
                    >
                      {/* Code */}
                      <td className="px-3 py-2.5 font-mono font-bold text-gold-400 whitespace-nowrap">
                        {row.migrationCode}
                      </td>

                      {/* Primary Name */}
                      <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap" style={{ maxWidth: 160 }}>
                        <span className="block truncate" title={row.primaryName}>{row.primaryName}</span>
                      </td>

                      {/* Sub-account count */}
                      <td className="px-3 py-2.5 text-zinc-400 text-center">
                        {row.subAccountCount}
                      </td>

                      {/* Categories */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex gap-1 flex-wrap">
                          {row.categories.map((c) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.05] text-zinc-400"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Total Savings */}
                      <td className="px-3 py-2.5 font-mono text-zinc-300 whitespace-nowrap text-right">
                        {fmt(row.totals.totalSavings)}
                      </td>

                      {/* Total Withdrawn */}
                      <td className="px-3 py-2.5 font-mono text-zinc-400 whitespace-nowrap text-right">
                        {fmt(row.totals.totalWtd)}
                      </td>

                      {/* Net Balance */}
                      <td className="px-3 py-2.5 font-mono text-emerald-400 whitespace-nowrap text-right font-semibold">
                        {fmt(row.totals.totalBal)}
                      </td>

                      {/* Commission */}
                      <td className="px-3 py-2.5 font-mono text-zinc-500 whitespace-nowrap text-right">
                        {fmt(row.totals.totalCommission)}
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLES[row.migrationStatus]}`}
                        >
                          {STATUS_LABELS[row.migrationStatus]}
                        </span>
                      </td>

                      {/* Customer name */}
                      <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap" style={{ maxWidth: 140 }}>
                        <span className="block truncate" title={row.customerName ?? ""}>{row.customerName ?? "—"}</span>
                      </td>

                      {/* Submitted date */}
                      <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">
                        {fmtDate(row.submittedAt)}
                      </td>

                      {/* Reviewed date */}
                      <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">
                        {fmtDate(row.reviewedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Footer totals row */}
              <tfoot>
                <tr
                  className="border-t border-white/[0.08]"
                  style={{ background: "rgba(212,175,55,0.03)" }}
                >
                  <td colSpan={4} className="px-3 py-2.5 text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">
                    {filtered.length} of {rows.length} records
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400 text-right font-semibold whitespace-nowrap">
                    {fmt(grandTotals.savings)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400 text-right font-semibold whitespace-nowrap">
                    {fmt(grandTotals.wtd)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-emerald-400 text-right font-bold whitespace-nowrap">
                    {fmt(grandTotals.bal)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-500 text-right font-semibold whitespace-nowrap">
                    {fmt(grandTotals.commission)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
