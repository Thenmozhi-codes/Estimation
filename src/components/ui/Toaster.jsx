import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X, AlertTriangle } from "lucide-react";
import { toastBus } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};
const TONE = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  error:   "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  info:    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
};
const ICON_COLOR = {
  success: "text-emerald-600 dark:text-emerald-400",
  error:   "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info:    "text-blue-600 dark:text-blue-400",
};

export function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return toastBus.on((t) => {
      const id = Math.random().toString(36).slice(2);
      setItems((arr) => [...arr, { id, ...t }]);
      setTimeout(() => {
        setItems((arr) => arr.filter((x) => x.id !== id));
      }, 3200);
    });
  }, []);

  return (
    <div className="fixed top-3 right-3 left-3 sm:left-auto sm:top-4 sm:right-4 z-[10001] flex flex-col gap-2 sm:w-80">
      {items.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm shadow-md animate-slide-in-right backdrop-blur-sm",
              TONE[t.type] || TONE.info,
            )}
          >
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", ICON_COLOR[t.type] || ICON_COLOR.info)} />
            <div className="flex-1 font-medium">{t.message}</div>
            <button
              onClick={() => setItems((arr) => arr.filter((x) => x.id !== t.id))}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}