import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Sheet({ open, onClose, title, subtitle, children, footer, width = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: "sm:max-w-md",
    md: "sm:max-w-xl",
    lg: "sm:max-w-3xl",
    xl: "sm:max-w-5xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998]">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 w-full bg-surface shadow-2xl flex flex-col",
          "animate-slide-in-right",
          widths[width],
        )}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-line shrink-0">
          <div className="min-w-0">
            <div className="font-semibold text-ink text-sm truncate">{title}</div>
            {subtitle && (
              <div className="text-xs text-muted truncate">{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-ink" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-5">
          {children}
        </div>

        {footer && (
          <div className="border-t border-line p-3 sm:p-4 flex items-center justify-end gap-2 shrink-0 bg-bg/40">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}