/*
 * Outstanding payment reminders.
 *
 * Everything here is calculated LIVE from the invoices, so:
 *   - a customer with money still due always has a reminder, and
 *   - the moment the outstanding becomes Rs. 0 the reminder disappears
 *     (nothing is stored that could get stuck).
 *
 * Outstanding = grand total - amount paid, for every invoice that is not
 * cancelled (same rule as Reports -> Outstanding).
 */

const EPSILON = 0.009;

export const invoiceBalance = (invoice) =>
  Math.max(0, (Number(invoice?.grandTotal) || 0) - (Number(invoice?.amountPaid) || 0));

/* Invoices of one customer that still have a balance */
export function dueInvoicesForParty(invoices = [], partyId, excludeInvoiceId = null) {
  if (!partyId) return [];

  return invoices.filter(
    (invoice) =>
      String(invoice.partyId) === String(partyId) &&
      invoice.status !== "cancelled" &&
      String(invoice.id) !== String(excludeInvoiceId) &&
      invoiceBalance(invoice) > EPSILON,
  );
}

export function outstandingForParty(invoices = [], partyId, excludeInvoiceId = null) {
  const due = dueInvoicesForParty(invoices, partyId, excludeInvoiceId);

  return {
    partyId,
    total: due.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0),
    count: due.length,
    invoices: due,
  };
}

/* [{ partyId, total, count, invoices }] — biggest outstanding first */
export function outstandingByParty(invoices = []) {
  const map = new Map();

  invoices.forEach((invoice) => {
    if (!invoice.partyId) return;
    if (invoice.status === "cancelled") return;

    const balance = invoiceBalance(invoice);
    if (balance <= EPSILON) return;

    const key = String(invoice.partyId);
    const row = map.get(key) || { partyId: invoice.partyId, total: 0, count: 0, invoices: [] };

    row.total += balance;
    row.count += 1;
    row.invoices.push(invoice);
    map.set(key, row);
  });

  return [...map.values()].sort((a, b) => b.total - a.total);
}

const inr = (value) =>
  `₹${(Number(value) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/* whole days a bill is past its due date (0 when not overdue / no due date) */
export function daysOverdue(invoice, today = new Date()) {
  if (!invoice?.dueDate) return 0;

  const due = new Date(invoice.dueDate);
  if (Number.isNaN(due.getTime())) return 0;

  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.floor((start(today) - start(due)) / 86400000);

  return days > 0 ? days : 0;
}

export const REMINDER_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ta", label: "தமிழ்" },
];

const TEXT = {
  en: {
    hello: (name) => `Hello ${name || "Sir/Madam"},`,
    greet: (company) => (company ? `Greetings from ${company}.` : "Greetings!"),
    intro: "This is a friendly reminder about your pending payment.",
    amount: "Outstanding amount",
    bills: "Pending bills",
    partial: (paid) => `paid ${paid}`,
    due: (date) => `due ${date}`,
    overdue: (days) => `overdue by ${days} day${days === 1 ? "" : "s"}`,
    more: (n) => `...and ${n} more bill${n === 1 ? "" : "s"}`,
    ask: "Kindly make the payment at the earliest.",
    ignore: "If you have already paid, please ignore this message.",
    thanks: "Thank you,",
  },
  ta: {
    hello: (name) => `வணக்கம் ${name || "ஐயா/அம்மா"},`,
    greet: (company) => (company ? `${company} சார்பாக வணக்கம்.` : "வணக்கம்!"),
    intro: "உங்களின் நிலுவைத் தொகை குறித்த நினைவூட்டல்.",
    amount: "நிலுவைத் தொகை",
    bills: "நிலுவையில் உள்ள பில்கள்",
    partial: (paid) => `செலுத்தியது ${paid}`,
    due: (date) => `கடைசி தேதி ${date}`,
    overdue: (days) => `${days} நாட்கள் தாமதம்`,
    more: (n) => `...மேலும் ${n} பில்கள்`,
    ask: "தயவுசெய்து விரைவில் தொகையைச் செலுத்தவும்.",
    ignore: "ஏற்கனவே செலுத்தியிருந்தால் இந்தச் செய்தியைப் புறக்கணிக்கவும்.",
    thanks: "நன்றி,",
  },
};

/*
 * Automatic reminder text:
 *   - outstanding amount
 *   - each pending bill (number, date, balance, due / overdue)
 *   - polite request, "ignore if paid", company name + phone
 */
export function buildReminderMessage({
  name,
  total,
  invoices = [],
  companyName = "",
  companyPhone = "",
  lang = "en",
}) {
  const t = TEXT[lang] || TEXT.en;
  const MAX = 5;

  const lines = invoices.slice(0, MAX).map((invoice, index) => {
    const bits = [];
    const date = shortDate(invoice.date);
    const balance = invoiceBalance(invoice);
    const paid = Number(invoice.amountPaid) || 0;
    const late = daysOverdue(invoice);

    let line = `${index + 1}. ${invoice.number || "Bill"}`;
    if (date) line += ` (${date})`;
    line += ` - ${inr(balance)}`;

    if (paid > 0.009) bits.push(t.partial(inr(paid)));
    if (late > 0) bits.push(t.overdue(late));
    else if (invoice.dueDate) bits.push(t.due(shortDate(invoice.dueDate)));

    return bits.length ? `${line} [${bits.join(", ")}]` : line;
  });

  const hidden = invoices.length - MAX;

  return [
    t.hello(name),
    "",
    t.greet(companyName),
    t.intro,
    "",
    `${t.amount}: ${inr(total)}`,
    ...(lines.length ? ["", `${t.bills}:`, ...lines] : []),
    ...(hidden > 0 ? [t.more(hidden)] : []),
    "",
    t.ask,
    t.ignore,
    "",
    t.thanks,
    ...(companyName ? [companyName] : []),
    ...(companyPhone ? [companyPhone] : []),
  ].join("\n");
}

/* "98765 43210" -> "919876543210" (India); returns "" when it is not a usable number */
export function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;

  return "";
}

export function whatsappUrl(phone, message) {
  const number = normalizePhone(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : "";
}

export function smsUrl(phone, message) {
  const number = normalizePhone(phone);
  return number ? `sms:+${number}?body=${encodeURIComponent(message)}` : "";
}
