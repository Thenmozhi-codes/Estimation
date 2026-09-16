import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Search, Package, Users, FileText, Receipt, ShoppingCart, X,
} from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { cn } from "@/lib/utils/cn";

const ICONS = {
  product: Package,
  customer: Users,
  supplier: Users,
  quotation: FileText,
  invoice: Receipt,
  purchase: ShoppingCart,
};

const LABELS = {
  product: "Product",
  customer: "Customer",
  supplier: "Supplier",
  quotation: "Quotation",
  invoice: "Invoice",
  purchase: "Purchase",
};

export function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const results = useGlobalSearch(q);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 40);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[active]) {
          navigate(results[active].path);
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, results, active, navigate, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-3 md:pt-24"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative bg-surface rounded-xl border border-line w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl animate-scale-in">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Search className="h-4 w-4 text-muted shrink-0" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, parties, quotations, invoices…"
            className="w-full h-9 text-sm bg-transparent text-ink border-0 outline-none focus:ring-0 placeholder:text-subtle"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {!q.trim() ? (
            <div className="p-8 text-center">
              <div className="text-xs text-muted">
                Type to search across products, parties and documents
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm font-medium text-ink">
                No results for "{q}"
              </div>
              <div className="text-xs text-muted mt-1">
                Try a different search term
              </div>
            </div>
          ) : (
            <div className="py-1">
              {results.map((r, i) => {
                const Icon = ICONS[r.type] || Search;
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => {
                      navigate(r.path);
                      onClose();
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors",
                      active === i
                        ? "bg-brand-50 dark:bg-brand-950/30"
                        : "hover:bg-bg",
                    )}
                  >
                    <div className="w-7 h-7 rounded-md bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">
                        {r.label}
                      </div>
                      {r.sublabel && (
                        <div className="text-2xs text-muted truncate">
                          {r.sublabel}
                        </div>
                      )}
                    </div>
                    <div className="text-2xs uppercase tracking-wider text-muted font-semibold shrink-0">
                      {LABELS[r.type]}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-line px-4 py-2 flex items-center gap-4 text-[10px] text-muted bg-bg/40">
          <span className="flex items-center gap-1">
            <kbd className="border border-line rounded px-1 py-0.5 bg-surface">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border border-line rounded px-1 py-0.5 bg-surface">↵</kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border border-line rounded px-1 py-0.5 bg-surface">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}