import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  loading,
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-elevated rounded-xl border border-line w-full max-w-sm p-5 shadow-2xl animate-scale-in">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-danger" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-ink">{title}</div>
            {description && (
              <div className="text-sm text-muted mt-1">{description}</div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}