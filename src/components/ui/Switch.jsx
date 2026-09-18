import { cn } from "@/lib/utils/cn";

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 cursor-pointer select-none",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <span
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative inline-block w-9 h-5 rounded-full transition-colors duration-200",
          checked ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-premium",
            checked && "translate-x-4",
          )}
        />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}