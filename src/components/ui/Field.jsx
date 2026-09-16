import { cn } from "@/lib/utils/cn";

export function Field({ label, error, required, hint, className, children }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-xs font-semibold text-ink/80">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-2xs text-danger font-medium">{error}</p>
      ) : hint ? (
        <p className="text-2xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}