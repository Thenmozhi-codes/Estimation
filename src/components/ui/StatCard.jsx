import { cn } from "@/lib/utils/cn";

const TONES = {
  primary: "text-primary-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-red-600",
  neutral: "text-slate-500",
};

const ICON_BG = {
  primary: "bg-primary-50 dark:bg-primary-950/40",
  success: "bg-emerald-50 dark:bg-emerald-950/40",
  warning: "bg-amber-50 dark:bg-amber-950/40",
  danger: "bg-red-50 dark:bg-red-950/40",
  neutral: "bg-slate-100 dark:bg-slate-800",
};

/*
 * Summary card used at the top of list pages:
 *   label (small caps) · big count · amount in the tone colour on the right
 */
export function StatCard({ label, value, amount, tone = "primary", icon: Icon }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card md:px-5 md:py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </div>

        {Icon && (
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              ICON_BG[tone],
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", TONES[tone])} strokeWidth={2} />
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="text-2xl font-bold leading-none tracking-tight text-ink tabular-nums">
          {value}
        </div>

        {amount != null && (
          <div
            className={cn("truncate text-sm font-semibold tabular-nums", TONES[tone])}
            title={String(amount)}
          >
            {amount}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
