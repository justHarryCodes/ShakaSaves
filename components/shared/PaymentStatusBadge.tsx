import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/types";

const styles: Record<PaymentStatus, string> = {
  pending:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected:  "bg-red-500/10 text-red-400 border-red-500/20",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="outline" className={styles[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
