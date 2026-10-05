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

export function buildReminderMessage({ name, total, invoices = [], companyName = "" }) {
  const numbers = invoices
    .map((invoice) => invoice.number)
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");

  const more = invoices.length > 5 ? ` and ${invoices.length - 5} more` : "";

  return [
    `Hello ${name || "Sir/Madam"},`,
    "",
    `This is a gentle reminder${companyName ? ` from ${companyName}` : ""}. ` +
      `Your outstanding balance is ${inr(total)}` +
      (numbers ? ` (Invoice: ${numbers}${more}).` : "."),
    "",
    "Kindly arrange the payment at the earliest. Thank you!",
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
