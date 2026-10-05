import { IndianRupee } from "lucide-react";

const inr = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/*
 * Advance Payment + Balance Due rows for the form summary panel.
 * Shows nothing when there is no advance, so existing screens look the same.
 */
export function AdvanceBalanceRows({ advance = 0, balance = 0 }) {
  if (!(Number(advance) > 0)) return null;

  return (
    <div className="space-y-3 border-t border-dashed border-line pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">Advance Payment</span>
        <span className="text-sm font-medium text-emerald-600">
          - ₹ {inr(advance)}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="text-xs font-semibold text-muted">Balance Due</p>
        <div className="flex items-center gap-1 text-lg font-bold text-primary-600">
          <IndianRupee className="h-4 w-4" />
          <span>{inr(balance)}</span>
        </div>
      </div>
    </div>
  );
}

export default AdvanceBalanceRows;
