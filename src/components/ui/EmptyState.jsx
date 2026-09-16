import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  compact,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center mb-3",
          compact ? "w-10 h-10" : "w-14 h-14",
        )}
      >
        <Icon
          className={cn(
            "text-brand-500",
            compact ? "h-5 w-5" : "h-7 w-7",
          )}
          strokeWidth={1.5}
        />
      </div>
      <div className={cn("font-semibold text-ink", compact ? "text-sm" : "text-base")}>
        {title || "Nothing here yet"}
      </div>
      {description && (
        <div className="text-xs text-muted mt-1.5 max-w-sm leading-relaxed">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}