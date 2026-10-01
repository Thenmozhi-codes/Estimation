/*
 * Payment receipts, generated in the browser as PDFs. No extra library needed.
 *
 * One receipt is produced for EVERY payment made against an invoice.
 * Each receipt has its own number:  RCPT-<invoice number>-01, -02, -03 ...
 * (or payment.receiptNo if your backend already stores one - preferred).
 *
 * Standard PDF fonts cannot print the Rupee symbol or non-English letters,
 * so amounts are written as "Rs." and other characters become "?".
 */

/* ------------------------------------------------------------------ helpers */

function pdfText(value) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function rs(value) {
  const amount = Number(value) || 0;

  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}/${date.getFullYear()}`;
}

/* "bank_transfer" -> "Bank Transfer", "upi" -> "UPI" */
function modeLabel(raw) {
  const text = String(raw ?? "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!text) return "-";
  if (text.toLowerCase() === "upi") return "UPI";

  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const MODE_KEYS = ["mode", "paymentMode", "method", "paymentMethod", "type"];

function readMode(source) {
  for (const key of MODE_KEYS) {
    const value = source?.[key];

    if (value) return String(value);
  }

  return "";
}

function statusLabel(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .toUpperCase();
}

/* ----------------------------------------------------------------- payments */

/*
 * Returns the payments of an invoice, oldest first, each one already carrying
 * its own receipt number and running totals:
 *
 *   { receiptNo, amount, date, mode, reference, paidBefore, paidAfter, balanceAfter }
 *
 * If the invoice has money received but no payments array (old data), a single
 * payment is built from the invoice itself.
 */
const PAYMENT_LIST_KEYS = [
  "payments",
  "paymentHistory",
  "paymentsList",
  "receipts",
  "installments",
  "transactions",
];

function findPaymentList(invoice) {
  for (const key of PAYMENT_LIST_KEYS) {
    if (Array.isArray(invoice?.[key]) && invoice[key].length) {
      return invoice[key];
    }
  }

  return [];
}

export function getInvoicePayments(invoice, payments) {
  const source = Array.isArray(payments) ? payments : findPaymentList(invoice);

  let list = source.map((payment, index) => ({
    raw: payment,
    index,
    amount: Number(payment?.amount ?? payment?.amountPaid) || 0,
    date: payment?.date || payment?.paidAt || payment?.createdAt || "",
    mode: modeLabel(readMode(payment)),
    reference:
      payment?.reference ||
      payment?.referenceNo ||
      payment?.transactionId ||
      payment?.txnId ||
      "",
  }));

  if (!list.length && (Number(invoice?.amountPaid) || 0) > 0) {
    console.warn(
      `[receipt] Invoice ${invoice?.number}: no individual payments found, ` +
        "showing the total as one payment. Invoice keys:",
      Object.keys(invoice || {}),
    );
    list = [
      {
        raw: {},
        index: 0,
        amount: Number(invoice.amountPaid) || 0,
        date: invoice.paidAt || invoice.date || "",
        mode: modeLabel(readMode(invoice)),
        reference: "",
      },
    ];
  }

  /* oldest first, original order breaks ties */
  list.sort((a, b) => {
    const ta = new Date(a.date).getTime() || 0;
    const tb = new Date(b.date).getTime() || 0;

    return ta - tb || a.index - b.index;
  });

  const total = Number(invoice?.grandTotal) || 0;
  let running = 0;

  return list.map((item, position) => {
    const paidBefore = running;

    running += item.amount;

    return {
      receiptNo:
        item.raw?.receiptNo ||
        `RCPT-${invoice?.number || "INV"}-${String(position + 1).padStart(2, "0")}`,
      amount: item.amount,
      date: item.date,
      mode: item.mode,
      reference: item.reference,
      paidBefore,
      paidAfter: running,
      balanceAfter: Math.max(0, total - running),
    };
  });
}

/* ---------------------------------------------------------------- PDF build */

function buildPdf(ops) {
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;

  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

/* ------------------------------------------------------------------ receipt */

/*
 * Receipt for ONE payment.
 * `payment` is an entry from getInvoicePayments().
 */
export function buildReceiptPdf({
  invoice,
  customerName,
  payment,
  allPayments: givenPayments,
}) {
  const total = Number(invoice?.grandTotal) || 0;
  const allPayments = givenPayments || getInvoicePayments(invoice);

  const ops = [];

  const text = (x, y, value, { size = 11, bold = false, gray = false } = {}) => {
    ops.push(
      `BT ${gray ? "0.45 0.45 0.45" : "0 0 0"} rg /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`,
    );
  };

  const line = (x1, y1, x2, y2, width = 0.6) => {
    ops.push(`0.8 0.8 0.8 RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  const box = (x, y, w, h) => {
    ops.push(`0.8 0.8 0.8 RG 0.8 w ${x} ${y} ${w} ${h} re S`);
  };

  const row = (label, value, y, { bold = false } = {}) => {
    text(50, y, label, { size: 10, gray: true });
    text(210, y, value, { size: 11, bold });
  };

  /* Title */
  text(50, 780, "PAYMENT RECEIPT", { size: 22, bold: true });
  text(50, 760, `Receipt No: ${payment.receiptNo}`, { size: 10, gray: true });
  text(400, 760, `Date: ${formatDate(payment.date)}`, { size: 10, gray: true });

  line(50, 746, 545, 746);

  /* Details */
  row("Received from", customerName || "-", 715, { bold: true });
  row("Invoice number", invoice?.number || "-", 690);
  row("Invoice date", formatDate(invoice?.date), 665);
  row("Payment date", formatDate(payment.date), 640);
  row("Payment mode", payment.mode || "-", 615, { bold: true });

  if (payment.reference) {
    row("Reference", String(payment.reference), 590);
  }

  /* Amounts for THIS payment */
  box(40, 425, 515, 140);

  row("Invoice total", rs(total), 540);
  row("Paid before this payment", rs(payment.paidBefore), 516);
  row("Amount received now", rs(payment.amount), 492, { bold: true });

  line(70, 476, 525, 476);

  row("Balance due", rs(payment.balanceAfter), 446, { bold: true });

  /* Note */
  text(
    50,
    402,
    payment.balanceAfter > 0
      ? `Partial payment received. A balance of ${rs(payment.balanceAfter)} is still payable.`
      : "Payment received in full. Thank you.",
    { size: 10 },
  );

  /* Payment history of the invoice (only when there is more than one) */
  if (allPayments.length > 1) {
    const MAX_ROWS = 14;

    text(50, 370, "Payments on this invoice", { size: 11, bold: true });

    text(50, 352, "Receipt No", { size: 9, gray: true });
    text(250, 352, "Date", { size: 9, gray: true });
    text(330, 352, "Mode", { size: 9, gray: true });
    text(430, 352, "Amount", { size: 9, gray: true });

    line(50, 346, 545, 346);

    let y = 330;

    allPayments.slice(0, MAX_ROWS).forEach((item) => {
      const current = item.receiptNo === payment.receiptNo;

      text(50, y, item.receiptNo, { size: 9, bold: current });
      text(250, y, formatDate(item.date), { size: 9, bold: current });
      text(330, y, item.mode, { size: 9, bold: current });
      text(430, y, rs(item.amount), { size: 9, bold: current });

      if (current) text(512, y, "<", { size: 9, bold: true });

      y -= 16;
    });

    if (allPayments.length > MAX_ROWS) {
      text(50, y, `+ ${allPayments.length - MAX_ROWS} more payments`, {
        size: 9,
        gray: true,
      });
    }
  }

  line(50, 90, 545, 90);
  text(50, 72, "This is a computer generated receipt.", {
    size: 9,
    gray: true,
  });

  return buildPdf(ops);
}

/* ----------------------------------------------------------------- download */

/* Download the receipt of ONE payment (entry from getInvoicePayments). */
export function downloadPaymentReceipt({
  invoice,
  customerName,
  payment,
  allPayments,
}) {
  const pdf = buildReceiptPdf({ invoice, customerName, payment, allPayments });

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${payment.receiptNo}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}