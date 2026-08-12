"use client";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WithdrawalStatus } from "@/types";

export const WITHDRAWAL_STATUSES: WithdrawalStatus[] = ["pending", "approved", "paid", "rejected"];

interface WithdrawalStatusTabsProps {
  counts: Record<WithdrawalStatus, number>;
}

export function WithdrawalStatusTabs({ counts }: WithdrawalStatusTabsProps) {
  return (
    <TabsList className="w-full sm:w-fit bg-white/[0.04] border border-white/[0.06] h-9 p-0.5">
      {WITHDRAWAL_STATUSES.map((s) => (
        <TabsTrigger
          key={s}
          value={s}
          className="h-8 px-3 text-xs font-medium capitalize data-[state=active]:text-black data-[state=active]:font-semibold rounded-lg"
          style={{ ["--tw-data-active-bg" as string]: "#D4AF37" }}
        >
          {s}
          {counts[s] > 0 && (
            <span className="ml-1.5 opacity-70">{counts[s]}</span>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
