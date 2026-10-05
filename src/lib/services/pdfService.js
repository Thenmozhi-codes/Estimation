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

/* GST appears in the PDF only when it was applied on the document */
const hasGst = (doc, items) =>
  Number(doc?.taxTotal) > 0 ||
  (Array.isArray(items) &&
    items.some(
      (it) => Number(it?.taxRate) > 0 || Number(it?.taxAmount) > 0,
    ));

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

/* ───────── Quotation-only layout (invoice / purchase untouched) ───────── */

const qMoney = money;

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

function documentGstEnabled(doc, items) {
  if (doc?.gstEnabled === true) return true;
  if (doc?.gstEnabled === false) return false;
  return hasGst(doc, items);
}

function itemParts(it) {
  // Keep the document's saved product type/category intact. The PDF layout
  // must not substitute the product/brand name into the Product Type column.
  const productType =
    it.productTypeSnapshot ||
    it.productType ||
    "—";
  const brand =
    it.brandNameSnapshot ||
    it.brandName ||
    it.brand ||
    it.productNameSnapshot ||
    "—";
  const attrs = Array.isArray(it.attributesSnapshot)
    ? it.attributesSnapshot.map((a) => a?.value).filter(Boolean).join(" · ")
    : "";
  const specification = it.selectedSpecification || it.specification || it.specificationSnapshot || attrs || "—";
  return {
    productType: String(productType),
    brand: String(brand),
    specification: String(specification),
  };
}

function generateDocumentPdf({ company, party, doc, items, kind }) {
  const showGst = documentGstEnabled(doc, items);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mx = 40;
  const contentW = pageW - mx * 2;
  const footerY = pageH - 30;
  const AMBER = [180, 83, 9];
  const DARK = [120, 53, 15];
  const TEXT = [45, 45, 45];
  const MUTED = [105, 105, 105];
  const LINE = [220, 210, 200];
  const headerFill = [146, 64, 14];
  const innerW = contentW;
  const col = {
    no: { x: mx, w: 24 },
    product: { x: mx + 24, w: 82 },
    brand: { x: mx + 106, w: 66 },
    spec: { x: mx + 172, w: 108 },
    qty: { x: mx + 280, w: 36 },
    rate: { x: mx + 316, w: 70 },
    tax: { x: mx + 386, w: showGst ? 48 : 0 },
    amount: { x: 0, w: 81 },
  };
  col.amount.x = pageW - mx - col.amount.w;
  if (!showGst) {
    col.rate.w = 70;
    col.rate.x = col.amount.x - col.rate.w;
    col.qty.x = col.rate.x - col.qty.w;
    col.spec.x = col.qty.x - col.spec.w;
    col.brand.x = col.spec.x - col.brand.w;
    col.product.x = col.brand.x - col.product.w;
    col.no.x = mx;
  }

  const setText = (rgb) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  const safeLines = (value, width, font = 8) => {
    pdf.setFontSize(font);
    return pdf.splitTextToSize(String(value ?? "—"), width);
  };

  let y = 38;
  const logo = drawLogo(pdf, company?.logo, mx, 30, 48, 105);
  const cx = mx + (logo.width ? logo.width + 10 : 0);
  const textW = 285 - (logo.width ? logo.width + 10 : 0);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  setText(DARK);
  const companyLines = safeLines(company?.name || "Company", textW, 16);
  pdf.text(companyLines, cx, y);
  y += companyLines.length * 16 + 1;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  setText(MUTED);
  const info = [];
  if (company?.address) info.push(...safeLines(company.address, textW, 8.5));
  if (showGst && company?.gstin) info.push(`GSTIN: ${company.gstin}`);
  const contact = [company?.phone, company?.email].filter(Boolean).join("  ·  ");
  if (contact) info.push(contact);
  info.forEach((line) => { y += 11; pdf.text(line, cx, y); });

  const title = kind === "quotation" ? "QUOTATION" : kind === "invoice" ? (showGst ? "TAX INVOICE" : "INVOICE") : "PURCHASE";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  setText(AMBER);
  pdf.text(title, pageW - mx, 43, { align: "right" });
  pdf.setFontSize(10);
  setText(TEXT);
  pdf.text(doc.number || "—", pageW - mx, 61, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  setText(MUTED);
  pdf.text(`Date: ${shortDate(doc.date)}`, pageW - mx, 75, { align: "right" });
  if (doc.validUntil && kind === "quotation") pdf.text(`Valid Until: ${shortDate(doc.validUntil)}`, pageW - mx, 87, { align: "right" });
  if (doc.dueDate && kind === "invoice") pdf.text(`Due: ${shortDate(doc.dueDate)}`, pageW - mx, 87, { align: "right" });

  y = Math.max(y, 94, logo.bottom) + 9;
  pdf.setDrawColor(...AMBER); pdf.setLineWidth(1); pdf.line(mx, y, pageW - mx, y); y += 16;

  if (party?.name || party?.address || party?.phone || party?.email || party?.gstin) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); setText(DARK);
    pdf.text(kind === "purchase" ? "SUPPLIER" : "BILL TO", mx, y); y += 12;
    pdf.setFontSize(10.5); setText(TEXT); pdf.text(party?.name || "—", mx, y); y += 11;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); setText(MUTED);
    const partyLines = [
      party?.address,
      [party?.city, party?.state].filter(Boolean).join(", "),
      party?.phone,
      party?.email,
      showGst && party?.gstin ? `GSTIN: ${party.gstin}` : null,
    ].filter(Boolean);
    partyLines.forEach((line) => { safeLines(line, 300, 8.5).forEach((l) => { pdf.text(l, mx, y); y += 10; }); });
    y += 7;
  } else {
    y += 2;
  }

  const drawTableHeader = () => {
    pdf.setFillColor(...headerFill);
    pdf.rect(mx, y, innerW, 21, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(255,255,255);
    pdf.text("#", col.no.x + col.no.w/2, y + 13, {align:"center"});
    pdf.text("PRODUCT TYPE", col.product.x + 4, y + 13);
    pdf.text("BRAND", col.brand.x + 4, y + 13);
    pdf.text("SPECIFICATION", col.spec.x + 4, y + 13);
    pdf.text("QTY", col.qty.x + col.qty.w - 3, y + 13, {align:"right"});
    pdf.text("RATE", col.rate.x + col.rate.w - 4, y + 13, {align:"right"});
    if (showGst) pdf.text("GST", col.tax.x + col.tax.w - 3, y + 13, {align:"right"});
    pdf.text("AMOUNT", col.amount.x + col.amount.w - 4, y + 13, {align:"right"});
    y += 21;
  };

  drawTableHeader();
  items = Array.isArray(items) ? items : [];
  items.forEach((it, i) => {
    const p = itemParts(it);
    pdf.setFont("helvetica", "normal");
    const productLines = safeLines(p.productType, col.product.w - 7, 7.5);
    const brandLines = safeLines(p.brand, col.brand.w - 7, 7.5);
    const specLines = safeLines(p.specification, col.spec.w - 7, 7.5);
    const maxLines = Math.max(productLines.length, brandLines.length, specLines.length);
    const rowH = Math.max(28, maxLines * 9 + 12);
    if (y + rowH > pageH - 65) { pdf.addPage(); y = 42; drawTableHeader(); }
    if (i % 2) { pdf.setFillColor(253,247,240); pdf.rect(mx, y, innerW, rowH, "F"); }
    setText(TEXT); pdf.setFontSize(8);
    const base = y + 13;
    pdf.text(String(i+1), col.no.x + col.no.w/2, base, {align:"center"});
    pdf.text(productLines, col.product.x + 4, base);
    pdf.text(brandLines, col.brand.x + 4, base);
    setText(MUTED); pdf.text(specLines, col.spec.x + 4, base); setText(TEXT);
    pdf.text(String(it.quantity ?? 0), col.qty.x + col.qty.w - 3, base, {align:"right"});
    pdf.text(money(it.unitPrice), col.rate.x + col.rate.w - 4, base, {align:"right"});
    if (showGst) pdf.text(it.taxRate ? `${it.taxRate}%` : "—", col.tax.x + col.tax.w - 3, base, {align:"right"});
    pdf.setFont("helvetica", "bold"); pdf.text(money(it.lineTotal), col.amount.x + col.amount.w - 4, base, {align:"right"});
    pdf.setDrawColor(...LINE); pdf.setLineWidth(.5); pdf.line(mx, y + rowH, pageW-mx, y + rowH); y += rowH;
  });

  y += 16;
  const totalsW = 220;
  const tx = pageW - mx - totalsW;
  const valueX = pageW - mx;
  const totalRows = [];
  totalRows.push(["Subtotal", money(doc.subtotal)]);
  if (Number(doc.discount) > 0) totalRows.push(["Discount", "- " + money(doc.discount)]);
  if (showGst) {
    const rate = Number(doc.gstPercentage ?? doc.taxRate ?? (items.find((x) => Number(x?.taxRate) > 0)?.taxRate ?? 0));
    totalRows.push([rate ? `GST (${rate}%)` : "GST", money(doc.taxTotal)]);
  }
  const advanceAmt = kind === "quotation" ? Math.max(Number(doc.advancePayment) || 0, 0) : 0;
  const requiredH = totalRows.length * 16 + (kind === "invoice" && doc.amountPaid != null ? 52 : 28) + (advanceAmt > 0 ? 34 : 0);
  if (y + requiredH > pageH - 65) { pdf.addPage(); y = 42; }
  pdf.setFillColor(249,246,242); pdf.rect(tx, y - 8, totalsW, requiredH, "F");
  totalRows.forEach(([label,value]) => {
    pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5); setText(MUTED); pdf.text(label, tx+10, y); setText(TEXT); pdf.text(value,valueX-10,y,{align:"right"}); y += 16;
  });
  pdf.setDrawColor(...AMBER); pdf.setLineWidth(1); pdf.line(tx, y-4, valueX, y-4); y += 12;
  pdf.setFont("helvetica","bold"); pdf.setFontSize(11); setText(DARK); pdf.text("Grand Total", tx+10,y); pdf.text(money(doc.grandTotal),valueX-10,y,{align:"right"}); y += 19;
  if (kind === "invoice" && doc.amountPaid != null) {
    pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5); setText(MUTED); pdf.text("Paid",tx+10,y); setText(TEXT); pdf.text(money(doc.amountPaid),valueX-10,y,{align:"right"}); y+=14;
    pdf.setFont("helvetica","bold"); setText(DARK); pdf.text("Balance",tx+10,y); pdf.text(money(Math.max(0,(doc.grandTotal||0)-(doc.amountPaid||0))),valueX-10,y,{align:"right"}); y+=14;
  }

  if (advanceAmt > 0) {
    pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5); setText(MUTED); pdf.text("Advance Paid",tx+10,y); setText(TEXT); pdf.text("- " + money(advanceAmt),valueX-10,y,{align:"right"}); y+=14;
    pdf.setFont("helvetica","bold"); setText(DARK); pdf.text("Balance Due",tx+10,y); pdf.text(money(Math.max(0,(doc.grandTotal||0)-advanceAmt)),valueX-10,y,{align:"right"}); y+=14;
  }

  if (doc.notes) {
    y += 10; pdf.setFont("helvetica","bold"); pdf.setFontSize(8.5); setText(DARK); pdf.text("Notes",mx,y); y+=11;
    pdf.setFont("helvetica","normal"); setText(MUTED); pdf.text(pdf.splitTextToSize(String(doc.notes), contentW),mx,y);
  }

  const totalPages = pdf.internal.getNumberOfPages();
  for (let p=1;p<=totalPages;p++) {
    pdf.setPage(p); pdf.setDrawColor(...LINE); pdf.setLineWidth(.5); pdf.line(mx,pageH-43,pageW-mx,pageH-43);
    pdf.setFont("helvetica","italic"); pdf.setFontSize(7.5); setText([140,140,140]);
    pdf.text("Thank you for your business · Computer generated document.",mx,footerY);
    pdf.setFont("helvetica","normal"); pdf.text(`Page ${p} of ${totalPages}`,pageW-mx,footerY,{align:"right"});
  }
  return pdf;
}

export function downloadDocumentPdf(opts) {
  const pdf = generateDocumentPdf(opts);
  const prefix = opts.kind === "quotation" ? "QTN" : opts.kind === "invoice" ? "INV" : "PUR";
  pdf.save(`${prefix}-${opts.doc.number}.pdf`);
}
