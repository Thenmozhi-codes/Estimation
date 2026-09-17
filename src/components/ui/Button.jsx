import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

const VARIANTS = {
  primary: `
    bg-primary-600
    text-white
    border border-primary-600
    shadow-sm
    hover:bg-primary-700
    active:bg-primary-800
  `,

  secondary: `
    bg-surface
    text-ink
    border border-line
    shadow-xs
    hover:bg-bg
    hover:border-muted/40
  `,

  outline: `
    bg-transparent
    text-primary-600
    dark:text-primary-400
    border border-primary-200
    dark:border-primary-900
    hover:bg-primary-50
    dark:hover:bg-primary-950/30
  `,

  ghost: `
    bg-transparent
    text-muted
    border border-transparent
    hover:bg-bg
    hover:text-ink
  `,

  danger: `
    bg-danger
    text-white
    border border-danger
    shadow-xs
    hover:brightness-105
    active:brightness-95
  `,

  subtle: `
    bg-primary-50
    dark:bg-primary-950/30
    text-primary-700
    dark:text-primary-300
    border border-transparent
    hover:bg-primary-100
    dark:hover:bg-primary-950/50
  `,
};

const SIZES = {
  xs: "h-7 px-2.5 text-[11px] rounded-lg gap-1",
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-9 px-3.5 text-sm rounded-lg gap-2",
  lg: "h-10 px-4 text-sm rounded-xl gap-2",
  xl: "h-11 px-5 text-sm rounded-xl gap-2",
};

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    className,
    type = "button",
    loading = false,
    disabled = false,
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
        "inline-flex items-center justify-center",
        "font-semibold tracking-tight whitespace-nowrap",
        "transition-all duration-150 ease-premium",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-ring select-none",
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