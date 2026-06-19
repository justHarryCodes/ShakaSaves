import { Badge } from "@/components/ui/badge";
import type { WithdrawalStatus } from "@/types";

const styles: Record<WithdrawalStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  return (
    <Badge variant="outline" className={styles[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
