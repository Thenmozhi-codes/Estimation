import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = forwardRef(function Textarea(
  { className, rows = 3, error, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full px-3 py-2 text-sm rounded-md bg-surface text-ink resize-y",
        "border border-line placeholder:text-subtle",
        "transition-colors duration-150",
        "hover:border-muted/40",
        "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
        error && "border-danger",
        className,
      )}
      {...rest}
    />
  );
});