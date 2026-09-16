import { jsPDF } from "jspdf";

/* ───────── Formatters (self-contained, no deps) ───────── */

const money = (n, cur = "₹") =>
  `${cur}${(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/* ───────── Main export ───────── */

/**
 * @param {object} opts
 *   company   — company record
 *   party     — party record (customer / supplier)
 *   doc       — { number, date, validUntil?, dueDate?, status, subtotal, discount, taxTotal, grandTotal, amountPaid?, notes? }
 *   items     — array of line items (with productNameSnapshot, skuSnapshot, attributesSnapshot, quantity, unitPrice, discount, taxRate, taxAmount, lineTotal)
 *   kind      — 'quotation' | 'invoice' | 'purchase'
 */
export function generateDocumentPdf({ company, party, doc, items, kind }) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const mx = 40;           // margin
  let y = 44;

  /* ───── Header: company info (left) ───── */
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(120, 53, 15);
  pdf.text(company?.name || "Company", mx, y);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  y += 14;
  if (company?.address) pdf.text(company.address, mx, y), (y += 11);
  if (company?.gstin)   pdf.text(`GSTIN: ${company.gstin}`, mx, y), (y += 11);
  if (company?.phone || company?.email) {
    pdf.text(
      [company?.phone, company?.email].filter(Boolean).join("  ·  "),
      mx,
      y,
    );
    y += 11;
  }

  /* ───── Header: document title (right) ───── */
  const title =
    kind === "quotation" ? "QUOTATION"
    : kind === "invoice"  ? "TAX INVOICE"
    : "PURCHASE";

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(180, 83, 9);
  pdf.text(title, pageW - mx, 44, { align: "right" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  pdf.text(doc.number, pageW - mx, 62, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Date: ${shortDate(doc.date)}`, pageW - mx, 76, { align: "right" });
  if (doc.validUntil) pdf.text(`Valid Until: ${shortDate(doc.validUntil)}`, pageW - mx, 88, { align: "right" });
  if (doc.dueDate)    pdf.text(`Due: ${shortDate(doc.dueDate)}`, pageW - mx, 88, { align: "right" });

  y = Math.max(y, 100) + 6;

  /* ───── Divider ───── */
  pdf.setDrawColor(180, 83, 9);
  pdf.setLineWidth(1);
  pdf.line(mx, y, pageW - mx, y);
  y += 16;

  /* ───── Party block ───── */
  const partyLabel =
    kind === "purchase" ? "Supplier" : "Bill To";

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 53, 15);
  pdf.text(partyLabel.toUpperCase(), mx, y);
  y += 12;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  pdf.text(party?.name || "—", mx, y);
  y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90, 90, 90);
  const contact = [
    party?.phone,
    party?.email,
    party?.gstin ? `GSTIN: ${party.gstin}` : null,
    [party?.city, party?.state].filter(Boolean).join(", "),
  ].filter(Boolean);
  contact.forEach((line) => {
    pdf.text(line, mx, y);
    y += 11;
  });

  y += 6;

  /* ───── Item table ───── */
  const cols = {
    no:   mx,
    desc: mx + 24,
    qty:  pageW - mx - 260,
    rate: pageW - mx - 180,
    tax:  pageW - mx - 100,
    amt:  pageW - mx,
  };

  // Table header
  pdf.setFillColor(146, 64, 14);
  pdf.rect(mx, y, pageW - mx * 2, 20, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(255, 255, 255);
  pdf.text("#",     cols.no + 4, y + 13);
  pdf.text("Description", cols.desc, y + 13);
  pdf.text("Qty",    cols.qty,   y + 13, { align: "right" });
  pdf.text("Rate",   cols.rate,  y + 13, { align: "right" });
  pdf.text("Tax",    cols.tax,   y + 13, { align: "right" });
  pdf.text("Amount", cols.amt,   y + 13, { align: "right" });
  y += 20;

  // Rows
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(50, 50, 50);
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  items.forEach((it, i) => {
    // Page break
    if (y > 740) {
      pdf.addPage();
      y = 50;
    }

    // Row background (zebra)
    if (i % 2 === 1) {
      pdf.setFillColor(253, 246, 238);
      pdf.rect(mx, y, pageW - mx * 2, 22, "F");
    }

    const attrs =
      it.attributesSnapshot && it.attributesSnapshot.length
        ? it.attributesSnapshot.map((a) => a.value).filter(Boolean).join(" · ")
        : "";

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(50, 50, 50);
    pdf.text(String(i + 1), cols.no + 4, y + 14);
    pdf.text(truncate(it.productNameSnapshot || "—", 42), cols.desc, y + 14);

    // Sub-line: SKU + attrs
    if (it.skuSnapshot || attrs) {
      pdf.setFontSize(7.5);
      pdf.setTextColor(140, 140, 140);
      const sub = [it.skuSnapshot, attrs].filter(Boolean).join("  ·  ");
      pdf.text(truncate(sub, 60), cols.desc, y + 21);
      pdf.setFontSize(9);
      pdf.setTextColor(50, 50, 50);
    }

    pdf.text(String(it.quantity ?? 0), cols.qty, y + 14, { align: "right" });
    pdf.text(money(it.unitPrice), cols.rate, y + 14, { align: "right" });
    pdf.text(
      it.taxRate ? `${it.taxRate}%` : "—",
      cols.tax,
      y + 14,
      { align: "right" },
    );
    pdf.setFont("helvetica", "bold");
    pdf.text(money(it.lineTotal), cols.amt, y + 14, { align: "right" });
    pdf.setFont("helvetica", "normal");

    y += 24;
    pdf.setDrawColor(230, 214, 195);
    pdf.setLineWidth(0.5);
    pdf.line(mx, y - 4, pageW - mx, y - 4);
  });

  y += 12;

  /* ───── Totals ───── */
  const totalsX = pageW - mx - 220;
  const valueX = pageW - mx;

  const row = (label, value, opts = {}) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.big ? 12 : 9);
    pdf.setTextColor(opts.big ? 120 : 90, opts.big ? 53 : 90, opts.big ? 15 : 90);
    pdf.text(label, totalsX, y);
    pdf.text(value, valueX, y, { align: "right" });
    y += opts.big ? 20 : 14;
  };

  row("Subtotal", money(doc.subtotal));
  if ((doc.discount || 0) > 0) {
    row("Discount", "− " + money(doc.discount));
  }
  if ((doc.taxTotal || 0) > 0) {
    row("Tax", money(doc.taxTotal));
  }

  pdf.setDrawColor(180, 83, 9);
  pdf.setLineWidth(1);
  pdf.line(totalsX, y - 4, valueX, y - 4);
  y += 6;

  row("Grand Total", money(doc.grandTotal), { bold: true, big: true });

  if (kind === "invoice" && doc.amountPaid != null) {
    row("Paid", money(doc.amountPaid));
    row(
      "Balance",
      money((doc.grandTotal || 0) - (doc.amountPaid || 0)),
      { bold: true },
    );
  }

  /* ───── Notes ───── */
  if (doc.notes) {
    y += 14;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 53, 15);
    pdf.text("Notes", mx, y);
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(90, 90, 90);
    const lines = pdf.splitTextToSize(doc.notes, pageW - mx * 2);
    pdf.text(lines, mx, y);
    y += lines.length * 11;
  }

  /* ───── Footer ───── */
  const footerY = pdf.internal.pageSize.getHeight() - 30;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(140, 140, 140);
  pdf.text(
    "Thank you for your business · Computer generated document.",
    mx,
    footerY,
  );

  return pdf;
}

export function downloadDocumentPdf(opts) {
  const pdf = generateDocumentPdf(opts);
  const prefix = opts.kind === "quotation" ? "QTN"
    : opts.kind === "invoice" ? "INV"
    : "PUR";
  pdf.save(`${prefix}-${opts.doc.number}.pdf`);
}