"use client";
import { Check, ArrowDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface SavingsCalendarLegendProps {
  availableDays: number;
  withdrawnDays: number;
  commissionDays: number;
  /** Whether any day is colored blue (a second-or-later payment batch) — only
   *  shown when true, since a single-payment card never has a blue day. */
  hasBlueBatch?: boolean;
}

/**
 * The one legend for the savings calendar, shared by the customer and admin
 * card detail pages — previously two differently-styled, differently-worded
 * implementations (plus a third redundant summary on the admin page). Same
 * icons as SavingsMonthGrid's cell badges, so the legend visually teaches
 * what those icons mean.
 */
export function SavingsCalendarLegend({ availableDays, withdrawnDays, commissionDays, hasBlueBatch }: SavingsCalendarLegendProps) {
  const items: { color: string; icon: React.ReactNode; label: string }[] = [
    { color: "bg-emerald-500", icon: <Check size={9} strokeWidth={3} className="text-white" />, label: `Saved (${availableDays}d)` },
  ];
  if (hasBlueBatch) {
    items.push({ color: "bg-blue-500", icon: <Check size={9} strokeWidth={3} className="text-white" />, label: "Next payment" });
  }
  items.push({ color: "bg-red-500", icon: <ArrowDown size={9} strokeWidth={3} className="text-white" />, label: `Withdrawn (${withdrawnDays}d)` });
  if (commissionDays > 0) {
    items.push({ color: "", icon: <Star size={9} strokeWidth={3} className="text-black" />, label: `Commission (${commissionDays}d)` });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
      {items.map(({ color, icon, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className={cn("w-4 h-4 rounded-md flex items-center justify-center", color)}
            style={!color ? { background: "#D4AF37" } : undefined}
          >
            {icon}
          </span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
