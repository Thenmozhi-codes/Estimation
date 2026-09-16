import { cn } from "@/lib/utils/cn";

export function ChipToggle({ value, onChange, options, className }) {
  return (
    <div className={cn("inline-flex flex-wrap gap-1 p-1 rounded-lg bg-bg border border-line", className)}>
      {options.map((opt) => {
        const val = opt.value ?? opt;
        const label = opt.label ?? opt;
        const active = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange?.(val)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150",
              active
                ? "bg-surface text-brand-600 shadow-xs dark:text-brand-400"
                : "text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}