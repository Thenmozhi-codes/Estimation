import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export const Input = forwardRef(function Input(
  { className, error, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full h-9 px-3 text-sm rounded-lg bg-surface text-ink",
        "border border-line placeholder:text-subtle",
        "transition-all duration-150",
        "hover:border-muted/40",
        "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15",
        "disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:opacity-60",
        error && "border-danger focus:border-danger focus:ring-danger/15",
        className,
      )}
      {...rest}
    />
  );
});