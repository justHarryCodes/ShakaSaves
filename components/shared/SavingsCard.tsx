"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface SavingsCardProps {
  cardImageUrl: string | null;
  customerName: string;
  loading?: boolean;
}

export function SavingsCard({ cardImageUrl, customerName, loading }: SavingsCardProps) {
  if (loading) {
    return <Skeleton className="w-full aspect-[900/560] rounded-2xl" />;
  }

  if (!cardImageUrl) {
    return (
      <div className="w-full aspect-[900/560] rounded-2xl bg-[#0F172A] flex items-center justify-center">
        <p className="text-slate-500 text-sm">Card not yet generated</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cardImageUrl}
        alt={`${customerName}'s savings card`}
        className="w-full h-auto"
        style={{ aspectRatio: "900/560", objectFit: "cover" }}
      />
    </div>
  );
}
