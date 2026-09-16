import { cn } from "@/lib/utils/cn";

const TONES = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  info:    "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  warning: "bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  danger:  "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  primary: "bg-primary-50 text-primary-700 border-primary-100 dark:bg-primary-950/40 dark:text-primary-300 dark:border-primary-900",
};

const STATUS_TONE = {
  active: "success", inactive: "neutral",
  draft: "neutral", sent: "info", approved: "success",
  rejected: "danger", expired: "warning", converted: "primary",
  issued: "info", partially_paid: "warning", paid: "success",
  overdue: "danger", cancelled: "danger", received: "success",
  opening: "neutral", purchase: "success", sale: "primary",
  purchase_return: "warning", sales_return: "info", adjustment: "warning",
};

export function StatusBadge({ status, tone, className }) {
  if (!status) return null;
  const t = tone || STATUS_TONE[status] || "neutral";
  const label = String(status).replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md border text-2xs font-semibold capitalize whitespace-nowrap tracking-tight",
        TONES[t],
        className,
      )}
    >
      {label}
    </span>
  );
}