"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CreditCard, RefreshCw, ChevronRight as ChevronRightIcon } from "lucide-react";
import type { AdminCardRow, CategorySummary } from "@/app/api/v1/admin/cards/route";


function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminCardsPage() {
  const { idToken } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<AdminCardRow[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function fetchCards() {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/cards", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Failed to load cards");
      const json = await res.json();
      setCards(json.data.cards);
      setCategories(json.data.categories);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCards(); }, [idToken]);

  const filtered = useMemo(() => {
    let rows = cards;
    if (activeCategory !== "all") rows = rows.filter((c) => c.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          c.cardName.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [cards, activeCategory, search]);

  const activeSummary = useMemo<CategorySummary>(() => {
    if (activeCategory === "all") {
      return {
        category: "All",
        cardCount: filtered.length,
        totalSavings: filtered.reduce((s, c) => s + c.totalSavings, 0),
        withdrawn: filtered.reduce((s, c) => s + c.withdrawn, 0),
        balance: filtered.reduce((s, c) => s + c.balance, 0),
      };
    }
    return categories.find((c) => c.category === activeCategory) ?? {
      category: activeCategory,
      cardCount: 0,
      totalSavings: 0,
      withdrawn: 0,
      balance: 0,
    };
  }, [filtered, activeCategory, categories]);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard size={18} className="text-gold-400" />
            Cards
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            All savings cards grouped by category
          </p>
        </div>
        <button
          onClick={fetchCards}
          className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Category summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Cards",    value: activeSummary.cardCount.toString(), color: "text-white" },
          { label: "Total Savings",  value: naira(activeSummary.totalSavings),  color: "text-gold-400" },
          { label: "Withdrawn",      value: naira(activeSummary.withdrawn),     color: "text-amber-400" },
          { label: "Net Balance",    value: naira(activeSummary.balance),       color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.06] p-3.5"
            style={{ background: "#0D0D0D" }}
          >
            <div className={`text-xl font-bold font-mono truncate ${color}`}>{value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Category tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div
          className="flex gap-1 p-1 rounded-xl border border-white/[0.06] flex-wrap"
          style={{ background: "#0D0D0D" }}
        >
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeCategory === "all" ? "text-black font-semibold" : "text-zinc-500 hover:text-zinc-300"
            }`}
            style={activeCategory === "all" ? { background: "#D4AF37" } : undefined}
          >
            All
            <span className="ml-1.5 opacity-60">{cards.length}</span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === cat.category ? "text-black font-semibold" : "text-zinc-500 hover:text-zinc-300"
              }`}
              style={activeCategory === cat.category ? { background: "#D4AF37" } : undefined}
            >
              {cat.category}
              <span className="ml-1.5 opacity-60">{cat.cardCount}</span>
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer or card name…"
          className="flex-1 min-w-0 px-3 py-1.5 rounded-xl text-sm text-white placeholder-zinc-600 border border-white/[0.06] bg-[#0D0D0D] outline-none focus:border-gold-500/30 transition-colors"
        />
      </div>

      {/* Cards table / list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
          Loading cards…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-400 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
          No cards found
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: "#0D0D0D" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: "820px" }}>
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Customer", "Card Name", "₦/Day", "Days Marked", "Period", "Total Savings", "Withdrawn", "Balance", ""].map((h) => (
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
                {filtered.map((card, i) => (
                  <tr
                    key={card.id}
                    onClick={() => router.push(`/admin/cards/${card.id}`)}
                    className={`border-b border-white/[0.04] transition-colors cursor-pointer hover:bg-white/[0.03] ${
                      i % 2 !== 0 ? "bg-white/[0.01]" : ""
                    }`}
                  >
                    {/* Customer */}
                    <td className="px-3 py-3 text-white font-medium whitespace-nowrap">
                      {card.customerName}
                    </td>

                    {/* Card name + category */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-zinc-200 text-xs">{card.cardName}</span>
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-gold-500/10 text-gold-400 border-gold-500/20">
                            {card.category}
                          </span>
                          {card.migrated && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              migrated
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Daily rate */}
                    <td className="px-3 py-3 font-mono text-zinc-300 whitespace-nowrap">
                      {naira(card.dailyAmount)}
                    </td>

                    {/* Days marked */}
                    <td className="px-3 py-3 font-mono text-zinc-400 text-center">
                      {card.daysMarked}
                    </td>

                    {/* Period range */}
                    <td className="px-3 py-3 text-zinc-500 whitespace-nowrap text-[10px]">
                      {fmtDate(card.firstPeriod)}
                      {card.lastPeriod && card.lastPeriod !== card.firstPeriod && (
                        <> → {fmtDate(card.lastPeriod)}</>
                      )}
                    </td>

                    {/* Total savings */}
                    <td className="px-3 py-3 font-mono text-zinc-300 whitespace-nowrap text-right">
                      {naira(card.totalSavings)}
                    </td>

                    {/* Withdrawn */}
                    <td className="px-3 py-3 font-mono text-amber-400 whitespace-nowrap text-right">
                      {card.withdrawn > 0 ? naira(card.withdrawn) : "—"}
                    </td>

                    {/* Balance */}
                    <td className="px-3 py-3 font-mono text-emerald-400 font-semibold whitespace-nowrap text-right">
                      {naira(card.balance)}
                    </td>

                    {/* Arrow */}
                    <td className="px-3 py-3">
                      <ChevronRightIcon size={13} className="text-zinc-600" />
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Footer totals */}
              <tfoot>
                <tr className="border-t border-white/[0.08]" style={{ background: "rgba(212,175,55,0.03)" }}>
                  <td colSpan={5} className="px-3 py-2.5 text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">
                    {filtered.length} card{filtered.length !== 1 ? "s" : ""}
                    {activeCategory !== "all" && ` · ${activeCategory}`}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400 font-semibold text-right whitespace-nowrap">
                    {naira(activeSummary.totalSavings)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-amber-400 font-semibold text-right whitespace-nowrap">
                    {naira(activeSummary.withdrawn)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-emerald-400 font-bold text-right whitespace-nowrap">
                    {naira(activeSummary.balance)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
