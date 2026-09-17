import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  compact = false,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact
          ? "py-8 px-4"
          : "py-14 md:py-16 px-6",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-primary-50 dark:bg-primary-950/30",
          "flex items-center justify-center",
          compact
            ? "h-10 w-10"
            : "h-12 w-12",
        )}
      >
        <Icon
          className={cn(
            "text-primary-500",
            compact
              ? "h-5 w-5"
              : "h-6 w-6",
          )}
          strokeWidth={1.6}
        />
      </div>

      <div
        className={cn(
          "font-semibold text-ink",
          compact
            ? "text-sm mt-3"
            : "text-base mt-4",
        )}
      >
        {title || "Nothing here yet"}
      </div>

      {description && (
        <div className="text-xs text-muted mt-1.5 max-w-sm leading-relaxed">
          {description}
        </div>
      )}

      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}