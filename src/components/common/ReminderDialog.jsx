import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/ChipToggle";
import { Sheet } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";

import { toast } from "@/lib/toast";
import { companyRepo } from "@/lib/api/repos";
import { formatMoney } from "@/lib/utils/money";
import {
  REMINDER_LANGUAGES,
  buildReminderMessage,
  smsUrl,
  whatsappUrl,
} from "@/lib/utils/reminder";

/*
 * Preview of the automatic payment reminder.
 * The message is written for the customer (amount + pending bills + company
 * details); the user can read it, change the language, edit it, and send it
 * through WhatsApp / SMS or copy it.
 *
 *   <ReminderDialog
 *     open={Boolean(reminder)}
 *     onClose={() => setReminder(null)}
 *     reminder={{ name, phone, total, invoices }}
 *   />
 */
export function ReminderDialog({ open, onClose, reminder }) {
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });

  const [lang, setLang] = useState("en");
  const [text, setText] = useState("");

  const company = companies?.[0] || {};

  const generated = useMemo(
    () =>
      reminder
        ? buildReminderMessage({
            name: reminder.name,
            total: reminder.total,
            invoices: reminder.invoices || [],
            companyName: company.name || "",
            companyPhone: company.phone || company.mobile || "",
            lang,
          })
        : "",
    [reminder, company.name, company.phone, company.mobile, lang],
  );

  /* a fresh automatic message whenever it opens or the language changes */
  useEffect(() => {
    if (open) setText(generated);
  }, [open, generated]);

  useEffect(() => {
    if (open) setLang("en");
  }, [open, reminder?.name]);

  const wa = reminder ? whatsappUrl(reminder.phone, text) : "";
  const sms = reminder ? smsUrl(reminder.phone, text) : "";

  const openUrl = (url) => window.open(url, "_blank", "noopener,noreferrer");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Reminder message copied");
    } catch {
      toast.error("Could not copy the message");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="sm"
      title="Payment reminder"
      subtitle={
        reminder
          ? `${reminder.name || "Customer"} · ${formatMoney(reminder.total)} outstanding`
          : ""
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={copy}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          {sms && (
            <Button variant="secondary" onClick={() => openUrl(sms)}>
              <MessageSquare className="h-4 w-4" />
              SMS
            </Button>
          )}
          {wa && (
            <Button onClick={() => openUrl(wa)}>
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-muted">Message language</div>
          <ChipToggle value={lang} onChange={setLang} options={REMINDER_LANGUAGES} />
        </div>

        <Textarea
          rows={16}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="font-mono text-[0.875rem] leading-relaxed"
        />

        <div className="flex items-center justify-between text-2xs text-muted">
          <span>You can edit the message before sending.</span>
          <button
            type="button"
            onClick={() => setText(generated)}
            className="font-bold text-primary-600 hover:underline"
          >
            Reset message
          </button>
        </div>

        {!wa && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30">
            No valid phone number for this customer. Add one in Master → Customers
            to send on WhatsApp / SMS, or copy the message.
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default ReminderDialog;
