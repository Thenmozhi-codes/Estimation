import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Checkbox({ checked, onChange, disabled, label }) {
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
          "w-4 h-4 rounded border flex items-center justify-center transition-all duration-150",
          checked
            ? "bg-brand-500 border-brand-500 text-white"
            : "bg-surface border-line hover:border-brand-500/60",
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}