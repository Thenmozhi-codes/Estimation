import {
  Bell,
  Package,
  Receipt,
  Clock,
  Check,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

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
      return JSON.parse(
        localStorage.getItem("timber-erp-seen-notifs") || "[]",
      );
    } catch {
      return [];
    }
  });

  const notifications = useMemo(() => {
    const items = [];

    invoices
      .filter(
        (invoice) =>
          invoice.dueDate &&
          new Date(invoice.dueDate) < new Date() &&
          (invoice.grandTotal || 0) -
            (invoice.amountPaid || 0) >
            0.009 &&
          invoice.status !== "cancelled",
      )
      .slice(0, 5)
      .forEach((invoice) => {
        items.push({
          id: `overdue-${invoice.id}`,
          type: "danger",
          icon: Receipt,
          title: `Invoice ${invoice.number} is overdue`,
          subtitle:
            formatMoney(
              Math.max(
                0,
                (invoice.grandTotal || 0) -
                  (invoice.amountPaid || 0),
              ),
            ) + " pending",
          path: `/bills/invoices/${invoice.id}`,
        });
      });

    quotations
      .filter(
        (quotation) =>
          quotation.status === "draft" ||
          quotation.status === "sent",
      )
      .slice(0, 3)
      .forEach((quotation) => {
        items.push({
          id: `pending-${quotation.id}`,
          type: "info",
          icon: Clock,
          title: `Quotation ${quotation.number} awaiting response`,
          subtitle: `Status: ${quotation.status}`,
          path: `/bills/quotations/${quotation.id}`,
        });
      });

    stockRows
      .filter((row) => row.lowStock)
      .slice(0, 3)
      .forEach((row) => {
        items.push({
          id: `low-${row.id}`,
          type: "warning",
          icon: Package,
          title: `Low stock: ${row.productName}`,
          subtitle: `${row.variantSku} — only ${row.quantity} left`,
          path: "/master/products",
        });
      });

    return items;
  }, [invoices, quotations, stockRows]);

  const unread = notifications.filter(
    (item) => !seenIds.includes(item.id),
  ).length;

  const markAllRead = () => {
    const ids = notifications.map((item) => item.id);

    setSeenIds(ids);

    localStorage.setItem(
      "timber-erp-seen-notifs",
      JSON.stringify(ids),
    );
  };

  return (
    <Dropdown
      width="w-[340px]"
      trigger={
        <button
          type="button"
          className="
            relative
            h-9
            w-9
            rounded-lg
            flex
            items-center
            justify-center
            text-muted
            hover:text-ink
            hover:bg-bg
            transition-colors
          "
        >
          <Bell className="h-[17px] w-[17px]" />

          {unread > 0 && (
            <span
              className="
                absolute
                top-1
                right-1
                min-w-[15px]
                h-[15px]
                px-1
                rounded-full
                bg-danger
                text-white
                text-[9px]
                font-bold
                flex
                items-center
                justify-center
                ring-2
                ring-surface
              "
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div>
          <div className="text-sm font-semibold text-ink">
            Notifications
          </div>

          <div className="text-[11px] text-muted mt-0.5">
            {unread > 0
              ? `${unread} unread`
              : "You're all caught up"}
          </div>
        </div>

        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <Check className="h-3 w-3" />
            Mark all
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="mx-auto h-10 w-10 rounded-xl bg-bg flex items-center justify-center">
            <Bell className="h-4 w-4 text-muted" />
          </div>

          <div className="text-sm font-medium text-ink mt-3">
            You're all caught up
          </div>

          <div className="text-xs text-muted mt-1">
            No new notifications.
          </div>
        </div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
          {notifications.map((item) => {
            const Icon = item.icon;
            const seen = seenIds.includes(item.id);

            const tone = {
              danger:
                "text-red-600 bg-red-50 dark:bg-red-950/30",
              warning:
                "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
              info:
                "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
            }[item.type];

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full text-left px-4 py-3 flex items-start gap-3 border-b border-line/60 last:border-0",
                  "hover:bg-bg transition-colors",
                  seen && "opacity-55",
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                    tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink truncate">
                    {item.title}
                  </div>

                  <div className="text-[11px] text-muted truncate mt-0.5">
                    {item.subtitle}
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