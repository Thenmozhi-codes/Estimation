import { jsPDF } from "jspdf";

/* ───────── Formatters (self-contained, no deps) ───────── */

/*
 * jsPDF's standard fonts have no Rupee glyph. A string containing one is
 * re-encoded and every letter gets stretched ("4 , 7 6 0 . 0 0"), so all
 * documents print "Rs." instead. The same applies to the unicode minus
 * sign, so a plain "-" is used.
 */
const money = (n) =>
  `Rs. ${(Number(n) || 0).toLocaleString("en-IN", {
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



/*
 * Draws the company logo (a data URL saved in Settings > Company) inside a
 * maxW x maxH box, keeping its proportions. Returns the space it used, so the
 * company text can be moved to the right of it. A missing or broken logo is
 * skipped and never stops the PDF from being created.
 */
function drawLogo(pdf, dataUrl, x, y, maxH = 52, maxW = 140) {
  const none = { width: 0, bottom: 0 };

  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return none;
  }

  try {
    const props = pdf.getImageProperties(dataUrl);
    const ratio = props.width / props.height;

    let h = maxH;
    let w = h * ratio;

    if (w > maxW) {
      w = maxW;
      h = w / ratio;
    }

    pdf.addImage(dataUrl, props.fileType, x, y, w, h);

    return { width: w, bottom: y + h };
  } catch (error) {
    console.warn("Logo could not be added to the PDF:", error);
    return none;
  }
}

/* Brand/Product + Specification for one line, from whatever the item holds */
function describeItem(it) {
  const brand = it.productNameSnapshot || it.brandName || it.productName || "—";

  const attrs = Array.isArray(it.attributesSnapshot)
    ? it.attributesSnapshot.map((a) => a?.value).filter(Boolean).join(" · ")
    : "";

  const spec =
    it.selectedSpecification ||
    it.specificationSnapshot ||
    attrs ||
    it.skuSnapshot ||
    "";

  return { brand, spec: String(spec || "") };
}

/* ───────── Quotation layout (unchanged) ───────── */

const qMoney = money;

function generateQuotationPdf({ company, party, doc, items }) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mx = 40;
  const contentW = pageW - mx * 2;
  const bottomLimit = pageH - 60; // keeps room for footer

  const AMBER = [180, 83, 9];
  const DARK = [120, 53, 15];
  const TEXT = [40, 40, 40];
  const MUTED = [110, 110, 110];
  const LINE = [214, 196, 176];

  /* Column layout (x = left edge, w = width) */
  const col = {
    no:   { x: mx,        w: 34 },
    desc: { x: mx + 34,   w: 0 }, // width filled below
    qty:  { x: 0,         w: 62 },
    rate: { x: 0,         w: 78 },
    tax:  { x: 0,         w: 62 },
    amt:  { x: 0,         w: 84 },
  };
  col.amt.x  = pageW - mx - col.amt.w;
  col.tax.x  = col.amt.x - col.tax.w;
  col.rate.x = col.tax.x - col.rate.w;
  col.qty.x  = col.rate.x - col.qty.w;
  col.desc.w = col.qty.x - col.desc.x;
  const pad = 6;

  const setText = (rgb) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);

  /* ───── Header ───── */
  const logo = drawLogo(pdf, company?.logo, mx, 34);
  const cx = mx + (logo.width ? logo.width + 12 : 0);
  const textW = 300 - (logo.width ? logo.width + 12 : 0);

  let y = 46;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  setText(DARK);
  const compLines = pdf.splitTextToSize(company?.name || "Company", textW);
  pdf.text(compLines, cx, y);
  y += compLines.length * 17 - 3;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  setText(MUTED);
  const compInfo = [];
  if (company?.address) compInfo.push(...pdf.splitTextToSize(company.address, textW));
  if (company?.gstin) compInfo.push(`GSTIN: ${company.gstin}`);
  const cc = [company?.phone, company?.email].filter(Boolean).join("  ·  ");
  if (cc) compInfo.push(cc);
  compInfo.forEach((l) => {
    y += 12;
    pdf.text(l, cx, y);
  });

  /* Right block */
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  setText(AMBER);
  pdf.text("QUOTATION", pageW - mx, 48, { align: "right" });

  pdf.setFontSize(10);
  setText(TEXT);
  pdf.text(`No: ${doc.number || "—"}`, pageW - mx, 68, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  setText(MUTED);
  let ry = 82;
  pdf.text(`Date: ${shortDate(doc.date)}`, pageW - mx, ry, { align: "right" });
  if (doc.validUntil) {
    ry += 12;
    pdf.text(`Valid Until: ${shortDate(doc.validUntil)}`, pageW - mx, ry, { align: "right" });
  }

  y = Math.max(y, ry, logo.bottom) + 14;
  pdf.setDrawColor(...AMBER);
  pdf.setLineWidth(1.2);
  pdf.line(mx, y, pageW - mx, y);
  y += 18;

  /* ───── Customer block ───── */
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  setText(DARK);
  pdf.text("QUOTATION FOR", mx, y);
  y += 13;

  pdf.setFontSize(11.5);
  setText(TEXT);
  const pName = pdf.splitTextToSize(party?.name || "—", contentW);
  pdf.text(pName, mx, y);
  y += pName.length * 13;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  setText(MUTED);
  [
    party?.address,
    [party?.city, party?.state].filter(Boolean).join(", "),
    party?.phone,
    party?.email,
    party?.gstin ? `GSTIN: ${party.gstin}` : null,
  ]
    .filter(Boolean)
    .forEach((line) => {
      pdf.splitTextToSize(String(line), contentW).forEach((l) => {
        pdf.text(l, mx, y);
        y += 11;
      });
    });

  y += 12;

  /* ───── Table ───── */
  const drawTableHeader = () => {
    pdf.setFillColor(146, 64, 14);
    pdf.rect(mx, y, contentW, 22, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    const ty = y + 14.5;
    pdf.text("S.No", col.no.x + col.no.w / 2, ty, { align: "center" });
    pdf.text("Description", col.desc.x + pad, ty);
    pdf.text("Qty", col.qty.x + col.qty.w - pad, ty, { align: "right" });
    pdf.text("Rate", col.rate.x + col.rate.w - pad, ty, { align: "right" });
    pdf.text("Tax", col.tax.x + col.tax.w - pad, ty, { align: "right" });
    pdf.text("Amount", col.amt.x + col.amt.w - pad, ty, { align: "right" });
    y += 22;
  };

  drawTableHeader();

  const lineH = 11.5;
  const descW = col.desc.w - pad * 2;

  items.forEach((it, i) => {
    const { brand, spec } = describeItem(it);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    const brandLines = pdf.splitTextToSize(brand, descW);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const specLines = spec ? pdf.splitTextToSize(spec, descW) : [];

    const rowH = Math.max(
      28,
      10 + brandLines.length * lineH + specLines.length * 10.5 + 8,
    );

    if (y + rowH > bottomLimit) {
      pdf.addPage();
      y = 44;
      drawTableHeader();
    }

    if (i % 2 === 1) {
      pdf.setFillColor(253, 247, 240);
      pdf.rect(mx, y, contentW, rowH, "F");
    }

    const baseY = y + 15;

    /* S.No */
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    setText(TEXT);
    pdf.text(String(i + 1), col.no.x + col.no.w / 2, baseY, { align: "center" });

    /* Description: Brand (bold) + Specification (muted) */
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.text(brandLines, col.desc.x + pad, baseY);
    if (specLines.length) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      setText(MUTED);
      pdf.text(specLines, col.desc.x + pad, baseY + brandLines.length * lineH - 1);
    }

    /* Numbers */
    setText(TEXT);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const qtyTxt = `${it.quantity ?? 0}`;
    pdf.text(qtyTxt, col.qty.x + col.qty.w - pad, baseY, { align: "right" });
    if (it.unit || it.unitSnapshot) {
      pdf.setFontSize(7.5);
      setText(MUTED);
      pdf.text(String(it.unit || it.unitSnapshot), col.qty.x + col.qty.w - pad, baseY + 10, { align: "right" });
      pdf.setFontSize(9);
      setText(TEXT);
    }

    pdf.text(qMoney(it.unitPrice), col.rate.x + col.rate.w - pad, baseY, { align: "right" });

    pdf.text(it.taxRate ? `${it.taxRate}%` : "—", col.tax.x + col.tax.w - pad, baseY, { align: "right" });
    if (it.taxAmount) {
      pdf.setFontSize(7.5);
      setText(MUTED);
      pdf.text(qMoney(it.taxAmount), col.tax.x + col.tax.w - pad, baseY + 10, { align: "right" });
      pdf.setFontSize(9);
      setText(TEXT);
    }

    pdf.setFont("helvetica", "bold");
    pdf.text(qMoney(it.lineTotal), col.amt.x + col.amt.w - pad, baseY, { align: "right" });

    y += rowH;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.5);
    pdf.line(mx, y, pageW - mx, y);
  });

  /* ───── Totals ───── */
  const totalsW = 230;
  const tx = pageW - mx - totalsW;
  const rowsToDraw = [["Subtotal", qMoney(doc.subtotal)]];
  if ((doc.discount || 0) > 0) rowsToDraw.push(["Discount", "- " + qMoney(doc.discount)]);
  rowsToDraw.push(["Tax / GST", qMoney(doc.taxTotal)]);

  const totalsH = rowsToDraw.length * 18 + 44;
  if (y + 20 + totalsH > bottomLimit) {
    pdf.addPage();
    y = 44;
  }
  y += 20;

  rowsToDraw.forEach(([label, value]) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    setText(MUTED);
    pdf.text(label, tx + 8, y);
    setText(TEXT);
    pdf.text(value, pageW - mx - 8, y, { align: "right" });
    y += 18;
  });

  pdf.setFillColor(146, 64, 14);
  pdf.rect(tx, y - 4, totalsW, 28, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Grand Total", tx + 8, y + 14);
  pdf.text(qMoney(doc.grandTotal), pageW - mx - 8, y + 14, { align: "right" });
  y += 40;

  /* ───── Notes ───── */
  if (doc.notes) {
    const noteLines = pdf.splitTextToSize(String(doc.notes), contentW);
    if (y + 16 + Math.min(noteLines.length, 1) * 11 > bottomLimit) {
      pdf.addPage();
      y = 44;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    setText(DARK);
    pdf.text("Notes", mx, y);
    y += 13;
    pdf.setFont("helvetica", "normal");
    setText(MUTED);
    noteLines.forEach((l) => {
      if (y > bottomLimit) {
        pdf.addPage();
        y = 44;
      }
      pdf.text(l, mx, y);
      y += 11;
    });
  }

  /* ───── Footer on every page ───── */
  const total = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.5);
    pdf.line(mx, pageH - 44, pageW - mx, pageH - 44);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    pdf.text("Thank you for your business · Computer generated quotation.", mx, pageH - 30);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Page ${p} of ${total}`, pageW - mx, pageH - 30, { align: "right" });
  }

  return pdf;
}

/* ───────── Invoice / Purchase layout (redesigned) ───────── */

function generateBillPdf({ company, party, doc, items, kind }) {
  const isInvoice = kind === "invoice";

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mx = 40;
  const contentW = pageW - mx * 2;
  const bottomLimit = pageH - 60; // keeps room for footer

  const AMBER = [180, 83, 9];
  const DARK = [120, 53, 15];
  const TEXT = [40, 40, 40];
  const MUTED = [110, 110, 110];
  const LINE = [214, 196, 176];
  const GREEN = [22, 128, 70];
  const RED = [200, 40, 40];

  const title = isInvoice ? "TAX INVOICE" : "PURCHASE";
  const partyLabel = isInvoice ? "BILL TO" : "SUPPLIER";

  /* Column layout (x = left edge, w = width) */
  const col = {
    no:   { x: mx,      w: 34 },
    desc: { x: mx + 34, w: 0 }, // width filled below
    qty:  { x: 0,       w: 62 },
    rate: { x: 0,       w: 78 },
    tax:  { x: 0,       w: 62 },
    amt:  { x: 0,       w: 84 },
  };
  col.amt.x  = pageW - mx - col.amt.w;
  col.tax.x  = col.amt.x - col.tax.w;
  col.rate.x = col.tax.x - col.rate.w;
  col.qty.x  = col.rate.x - col.qty.w;
  col.desc.w = col.qty.x - col.desc.x;
  const pad = 6;

  const setText = (rgb) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);

  /* ───── Header ───── */
  const logo = drawLogo(pdf, company?.logo, mx, 34);
  const cx = mx + (logo.width ? logo.width + 12 : 0);
  const textW = 300 - (logo.width ? logo.width + 12 : 0);

  let y = 46;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  setText(DARK);
  const compLines = pdf.splitTextToSize(company?.name || "Company", textW);
  pdf.text(compLines, cx, y);
  y += compLines.length * 17 - 3;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  setText(MUTED);
  const compInfo = [];
  if (company?.address) compInfo.push(...pdf.splitTextToSize(company.address, textW));
  if (company?.gstin) compInfo.push(`GSTIN: ${company.gstin}`);
  const cc = [company?.phone, company?.email].filter(Boolean).join("  ·  ");
  if (cc) compInfo.push(cc);
  compInfo.forEach((l) => {
    y += 12;
    pdf.text(l, cx, y);
  });

  /* Right block */
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  setText(AMBER);
  pdf.text(title, pageW - mx, 48, { align: "right" });

  pdf.setFontSize(10);
  setText(TEXT);
  pdf.text(`No: ${doc.number || "—"}`, pageW - mx, 68, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  setText(MUTED);
  let ry = 82;
  pdf.text(`Date: ${shortDate(doc.date)}`, pageW - mx, ry, { align: "right" });
  if (doc.dueDate) {
    ry += 12;
    pdf.text(`Due Date: ${shortDate(doc.dueDate)}`, pageW - mx, ry, { align: "right" });
  }

  y = Math.max(y, ry, logo.bottom) + 14;
  pdf.setDrawColor(...AMBER);
  pdf.setLineWidth(1.2);
  pdf.line(mx, y, pageW - mx, y);
  y += 18;

  /* ───── Party block ───── */
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  setText(DARK);
  pdf.text(partyLabel, mx, y);
  y += 13;

  pdf.setFontSize(11.5);
  setText(TEXT);
  const pName = pdf.splitTextToSize(party?.name || "—", contentW);
  pdf.text(pName, mx, y);
  y += pName.length * 13;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  setText(MUTED);
  [
    party?.address,
    [party?.city, party?.state].filter(Boolean).join(", "),
    party?.phone,
    party?.email,
    party?.gstin ? `GSTIN: ${party.gstin}` : null,
  ]
    .filter(Boolean)
    .forEach((line) => {
      pdf.splitTextToSize(String(line), contentW).forEach((l) => {
        pdf.text(l, mx, y);
        y += 11;
      });
    });

  y += 12;

  /* ───── Table ───── */
  const drawTableHeader = () => {
    pdf.setFillColor(146, 64, 14);
    pdf.rect(mx, y, contentW, 22, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    const ty = y + 14.5;
    pdf.text("S.No", col.no.x + col.no.w / 2, ty, { align: "center" });
    pdf.text("Description", col.desc.x + pad, ty);
    pdf.text("Qty", col.qty.x + col.qty.w - pad, ty, { align: "right" });
    pdf.text("Rate", col.rate.x + col.rate.w - pad, ty, { align: "right" });
    pdf.text("Tax", col.tax.x + col.tax.w - pad, ty, { align: "right" });
    pdf.text("Amount", col.amt.x + col.amt.w - pad, ty, { align: "right" });
    y += 22;
  };

  drawTableHeader();

  const lineH = 11.5;
  const descW = col.desc.w - pad * 2;

  items.forEach((it, i) => {
    const { brand, spec } = describeItem(it);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    const brandLines = pdf.splitTextToSize(brand, descW);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const specLines = spec ? pdf.splitTextToSize(spec, descW) : [];

    const rowH = Math.max(
      30,
      10 + brandLines.length * lineH + specLines.length * 10.5 + 8,
    );

    if (y + rowH > bottomLimit) {
      pdf.addPage();
      y = 44;
      drawTableHeader();
    }

    if (i % 2 === 1) {
      pdf.setFillColor(253, 247, 240);
      pdf.rect(mx, y, contentW, rowH, "F");
    }

    const baseY = y + 15;

    /* S.No */
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    setText(TEXT);
    pdf.text(String(i + 1), col.no.x + col.no.w / 2, baseY, { align: "center" });

    /* Description: Brand (bold) + Specification (muted) */
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.text(brandLines, col.desc.x + pad, baseY);
    if (specLines.length) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      setText(MUTED);
      pdf.text(specLines, col.desc.x + pad, baseY + brandLines.length * lineH - 1);
    }

    /* Qty + unit */
    setText(TEXT);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`${it.quantity ?? 0}`, col.qty.x + col.qty.w - pad, baseY, { align: "right" });
    if (it.unit || it.unitSnapshot) {
      pdf.setFontSize(7.5);
      setText(MUTED);
      pdf.text(String(it.unit || it.unitSnapshot), col.qty.x + col.qty.w - pad, baseY + 10, { align: "right" });
      pdf.setFontSize(9);
      setText(TEXT);
    }

    /* Rate (+ line discount underneath, if any) */
    pdf.text(money(it.unitPrice), col.rate.x + col.rate.w - pad, baseY, { align: "right" });
    if ((it.discount || 0) > 0) {
      pdf.setFontSize(7.5);
      setText(MUTED);
      pdf.text(`Disc. - ${money(it.discount)}`, col.rate.x + col.rate.w - pad, baseY + 10, { align: "right" });
      pdf.setFontSize(9);
      setText(TEXT);
    }

    /* Tax % (+ tax amount underneath) */
    pdf.text(it.taxRate ? `${it.taxRate}%` : "—", col.tax.x + col.tax.w - pad, baseY, { align: "right" });
    if (it.taxAmount) {
      pdf.setFontSize(7.5);
      setText(MUTED);
      pdf.text(money(it.taxAmount), col.tax.x + col.tax.w - pad, baseY + 10, { align: "right" });
      pdf.setFontSize(9);
      setText(TEXT);
    }

    /* Line total */
    pdf.setFont("helvetica", "bold");
    pdf.text(money(it.lineTotal), col.amt.x + col.amt.w - pad, baseY, { align: "right" });

    y += rowH;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.5);
    pdf.line(mx, y, pageW - mx, y);
  });

  /* ───── Totals ───── */
  const totalsW = 230;
  const tx = pageW - mx - totalsW;

  const balance = Math.max(0, (doc.grandTotal || 0) - (doc.amountPaid || 0));
  const showPayments = isInvoice && doc.amountPaid != null;

  const rowsToDraw = [["Subtotal", money(doc.subtotal)]];
  if ((doc.discount || 0) > 0) rowsToDraw.push(["Discount", "- " + money(doc.discount)]);
  if ((doc.taxTotal || 0) > 0) rowsToDraw.push(["Tax / GST", money(doc.taxTotal)]);

  const totalsH =
    rowsToDraw.length * 18 + 44 + (showPayments ? 2 * 18 + 6 : 0);

  if (y + 20 + totalsH > bottomLimit) {
    pdf.addPage();
    y = 44;
  }
  y += 20;
  const totalsTop = y;

  rowsToDraw.forEach(([label, value]) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    setText(MUTED);
    pdf.text(label, tx + 8, y);
    setText(TEXT);
    pdf.text(value, pageW - mx - 8, y, { align: "right" });
    y += 18;
  });

  pdf.setFillColor(146, 64, 14);
  pdf.rect(tx, y - 4, totalsW, 28, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Grand Total", tx + 8, y + 14);
  pdf.text(money(doc.grandTotal), pageW - mx - 8, y + 14, { align: "right" });
  y += 40;

  if (showPayments) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    setText(MUTED);
    pdf.text("Paid", tx + 8, y);
    setText(GREEN);
    pdf.text(money(doc.amountPaid), pageW - mx - 8, y, { align: "right" });
    y += 18;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    setText(MUTED);
    pdf.text("Balance Due", tx + 8, y);
    setText(balance > 0.009 ? RED : GREEN);
    pdf.text(money(balance), pageW - mx - 8, y, { align: "right" });
    y += 18;
  }

  

  /* ───── Notes ───── */
  if (doc.notes) {
    const noteLines = pdf.splitTextToSize(String(doc.notes), contentW);
    if (y + 16 + Math.min(noteLines.length, 1) * 11 > bottomLimit) {
      pdf.addPage();
      y = 44;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    setText(DARK);
    pdf.text("Notes", mx, y);
    y += 13;
    pdf.setFont("helvetica", "normal");
    setText(MUTED);
    noteLines.forEach((l) => {
      if (y > bottomLimit) {
        pdf.addPage();
        y = 44;
      }
      pdf.text(l, mx, y);
      y += 11;
    });
  }

  /* ───── Footer on every page ───── */
  const total = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.5);
    pdf.line(mx, pageH - 44, pageW - mx, pageH - 44);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    pdf.text(
      `Thank you for your business · Computer generated ${isInvoice ? "invoice" : "document"}.`,
      mx,
      pageH - 30,
    );
    pdf.setFont("helvetica", "normal");
    pdf.text(`Page ${p} of ${total}`, pageW - mx, pageH - 30, { align: "right" });
  }

  return pdf;
}

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
  if (kind === "quotation") {
    return generateQuotationPdf({ company, party, doc, items });
  }

  return generateBillPdf({ company, party, doc, items, kind });
}

export function downloadDocumentPdf(opts) {
  const pdf = generateDocumentPdf(opts);
  const prefix = opts.kind === "quotation" ? "QTN"
    : opts.kind === "invoice" ? "INV"
    : "PUR";
  pdf.save(`${prefix}-${opts.doc.number}.pdf`);
}