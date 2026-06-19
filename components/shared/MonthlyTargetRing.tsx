"use client";

const SIZE = 120;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

function naira(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

interface MonthlyTargetRingProps {
  saved: number;
  target: number;
  label?: string;
}

export function MonthlyTargetRing({ saved, target, label = "Monthly Target" }: MonthlyTargetRingProps) {
  const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="rotate-[-90deg]">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="#1E293B"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="#10B981"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="text-center -mt-2">
        <p className="text-2xl font-mono font-bold text-emerald-400">{Math.round(pct)}%</p>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xs text-slate-500 font-mono">
          {naira(saved)} / {naira(target)}
        </p>
      </div>
    </div>
  );
}
