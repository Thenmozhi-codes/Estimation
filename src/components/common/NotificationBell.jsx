import { Bell, Package, Receipt, Clock, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useInvoices, useQuotations } from "@/hooks/useDocuments";
import { useStockEnriched } from "@/hooks/useInventory";
import { Dropdown } from "@/components/ui/Dropdown";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: invoices = [] } = useInvoices();
  const { data: quotations = [] } = useQuotations();
  const { rows: stockRows } = useStockEnriched();

  const [seenIds, setSeenIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("timber-erp-seen-notifs") || "[]");
    } catch {
      return [];
    }
  });

  const notifications = useMemo(() => {
    const items = [];

    // Overdue invoices (due date passed and unpaid)
    invoices
      .filter(
        (i) =>
          i.dueDate &&
          new Date(i.dueDate) < new Date() &&
          (i.grandTotal || 0) - (i.amountPaid || 0) > 0.009 &&
          i.status !== "cancelled",
      )
      .slice(0, 5)
      .forEach((i) =>
        items.push({
          id: `overdue-${i.id}`,
          type: "danger",
          icon: Receipt,
          title: `Invoice ${i.number} is overdue`,
          subtitle: formatMoney(
            Math.max(0, (i.grandTotal || 0) - (i.amountPaid || 0)),
          ) + " pending",
          path: `/bills/invoices/${i.id}`,
        }),
      );

    // Pending quotations (draft or sent)
    quotations
      .filter((q) => q.status === "draft" || q.status === "sent")
      .slice(0, 3)
      .forEach((q) =>
        items.push({
          id: `pending-${q.id}`,
          type: "info",
          icon: Clock,
          title: `Quotation ${q.number} awaiting response`,
          subtitle: `Status: ${q.status}`,
          path: `/bills/quotations/${q.id}`,
        }),
      );

    // Low stock
    stockRows
      .filter((r) => r.lowStock)
      .slice(0, 3)
      .forEach((r) =>
        items.push({
          id: `low-${r.id}`,
          type: "warning",
          icon: Package,
          title: `Low stock: ${r.productName}`,
          subtitle: `${r.variantSku} — only ${r.quantity} left`,
          path: `/master/products`,
        }),
      );

    return items;
  }, [invoices, quotations, stockRows]);

  const unread = notifications.filter((n) => !seenIds.includes(n.id)).length;

  const markAllRead = () => {
    const ids = notifications.map((n) => n.id);
    setSeenIds(ids);
    localStorage.setItem("timber-erp-seen-notifs", JSON.stringify(ids));
  };

  return (
    <Dropdown
      width="w-80"
      trigger={
        <button className="relative p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Bell className="h-4.5 w-4.5 text-ink" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <div className="text-xs font-semibold text-ink">Notifications</div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-2xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
          >
            <Check className="h-3 w-3" /> Mark all read
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-muted">
          You're all caught up 🎉
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {notifications.map((n) => {
            const Icon = n.icon;
            const tone = {
              danger: "text-danger bg-red-50 dark:bg-red-950/40",
              warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
              info: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
            }[n.type];
            const isSeen = seenIds.includes(n.id);
            return (
              <button
                key={n.id}
                onClick={() => navigate(n.path)}
                className={cn(
                  "w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b border-line/60 last:border-0 hover:bg-bg transition-colors",
                  isSeen && "opacity-60",
                )}
              >
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", tone)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink truncate">
                    {n.title}
                  </div>
                  <div className="text-2xs text-muted truncate mt-0.5">
                    {n.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Dropdown>
  );
}