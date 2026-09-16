import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Select = forwardRef(function Select(
  { className, error, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full h-9 pl-3 pr-8 text-sm rounded-lg bg-surface text-ink appearance-none",
          "border border-line",
          "transition-all duration-150",
          "hover:border-muted/40",
          "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15",
          error && "border-danger",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
    </div>
  );
});