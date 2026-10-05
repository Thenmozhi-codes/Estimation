import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, MessageCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { companyRepo } from "@/lib/api/repos";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { useInvoices } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import {
  buildReminderMessage,
  outstandingForParty,
  smsUrl,
  whatsappUrl,
} from "@/lib/utils/reminder";

/*
 * Payment reminder for ONE customer.
 *
 *   <PaymentReminder partyId={id} />
 *
 * Shows only while the customer still owes money. When the outstanding
 * becomes Rs. 0 it renders nothing, so the reminder stops by itself.
 * The message is sent through the customer's WhatsApp / SMS app (opened with
 * the text already filled in) or copied.
 */
export function useReminderMessage(partyId, excludeInvoiceId = null) {
  const { data: invoices = [] } = useInvoices();
  const { data: parties = [] } = useParties();
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });

  return useMemo(() => {
    const outstanding = outstandingForParty(invoices, partyId, excludeInvoiceId);
    const party = parties.find((p) => String(p.id) === String(partyId)) || null;

    return {
      party,
      ...outstanding,
      message: buildReminderMessage({
        name: party?.name,
        total: outstanding.total,
        invoices: outstanding.invoices,
        companyName: companies?.[0]?.name || "",
      }),
    };
  }, [invoices, parties, companies, partyId, excludeInvoiceId]);
}

export function PaymentReminder({ partyId, excludeInvoiceId = null, className }) {
  const { party, total, count, message } = useReminderMessage(partyId, excludeInvoiceId);

  if (!partyId || total <= 0.009) return null;

  const phone = party?.phone || party?.mobile || "";
  const wa = whatsappUrl(phone, message);
  const sms = smsUrl(phone, message);

  const open = (url) => window.open(url, "_blank", "noopener,noreferrer");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Reminder message copied");
    } catch {
      toast.error("Could not copy the message");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink">
            Payment reminder: {formatMoney(total)} outstanding
          </div>
          <div className="text-xs text-muted">
            {party?.name || "This customer"} has {count} unpaid invoice
            {count === 1 ? "" : "s"}.
            {!wa && " Add a phone number to send this on WhatsApp / SMS."}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {wa && (
          <Button size="sm" onClick={() => open(wa)}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        )}
        {sms && (
          <Button size="sm" variant="secondary" onClick={() => open(sms)}>
            <MessageSquare className="h-4 w-4" />
            SMS
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={copy}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>
    </div>
  );
}

export default PaymentReminder;
