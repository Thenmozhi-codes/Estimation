import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export const MoneyInput = forwardRef(function MoneyInput(
  { className, error, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">
        ₹
      </span>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        step="0.01"
        className={cn(
          "w-full h-9 pl-6 pr-3 text-sm rounded-md bg-surface text-ink text-right",
          "border border-line placeholder:text-subtle",
          "transition-colors duration-150",
          "hover:border-muted/40",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          error && "border-danger",
          className,
        )}
        {...rest}
      />
    </div>
  );
});