import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this content. Please try again.",
  onRetry,
  compact,
}) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center text-center " +
        (compact ? "py-8 px-4" : "py-16 px-6")
      }
    >
      <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-3">
        <AlertTriangle className="h-6 w-6 text-danger" strokeWidth={1.75} />
      </div>
      <div className="font-semibold text-ink">{title}</div>
      <div className="text-xs text-muted mt-1.5 max-w-sm">{description}</div>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}