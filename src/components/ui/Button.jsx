import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

const VARIANTS = {
  primary:
    "gradient-primary text-white border border-primary-600/20 shadow-xs hover:brightness-105 active:brightness-95",
  secondary:
    "bg-surface text-ink hover:bg-slate-50 dark:hover:bg-slate-800 border border-line shadow-xs",
  outline:
    "bg-transparent text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 border border-primary-200 dark:border-primary-900",
  ghost:
    "bg-transparent text-ink hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent",
  danger:
    "bg-danger text-white hover:brightness-110 active:brightness-95 border border-danger/30 shadow-xs",
  subtle:
    "bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-950/60 border border-transparent",
};

const SIZES = {
  xs: "h-7 px-2.5 text-2xs rounded-md gap-1",
  sm: "h-8 px-3 text-xs rounded-md gap-1.5",
  md: "h-9 px-3.5 text-sm rounded-lg gap-2",
  lg: "h-10 px-4 text-sm rounded-lg gap-2",
  xl: "h-11 px-5 text-base rounded-xl gap-2",
};

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    className,
    type = "button",
    loading = false,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap",
        "transition-all duration-150 ease-premium",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-ring select-none tracking-tight",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
});