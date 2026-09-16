import { cn } from "@/lib/utils/cn";

export function Card({ className, interactive, children, ...rest }) {
  return (
    <div
      className={cn(
        "bg-surface border border-line rounded-xl",
        "shadow-card",
        "transition-all duration-200 ease-premium",
        interactive && "hover:shadow-card-hover hover:-translate-y-[1px] cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className, dense }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-line",
        dense ? "px-4 py-2.5" : "px-5 py-3.5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="font-semibold text-ink text-sm tracking-tight">{title}</div>
        {subtitle && (
          <div className="text-2xs text-muted mt-0.5">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, dense, children }) {
  return (
    <div className={cn(dense ? "p-4" : "p-5", className)}>{children}</div>
  );
}