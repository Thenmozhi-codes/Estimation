import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  interactive = false,
  children,
  ...rest
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-line rounded-2xl",
        "shadow-card",
        "transition-all duration-200 ease-premium",
        interactive && [
          "cursor-pointer",
          "hover:-translate-y-[1px]",
          "hover:shadow-card-hover",
          "hover:border-line/80",
        ],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
  dense = false,
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        dense ? "px-4 py-3" : "px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        {title && (
          <div className="text-sm font-semibold tracking-tight text-ink">
            {title}
          </div>
        )}

        {subtitle && (
          <div className="text-xs text-muted mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-1.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function CardBody({
  className,
  children,
  dense = false,
}) {
  return (
    <div className={cn(dense ? "p-4" : "p-5", className)}>
      {children}
    </div>
  );
}