import * as XLSX from "xlsx";
import { isGstEnabled } from "@/lib/utils/gst";

const shortDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

function describeItem(it = {}) {
  const brand =
    it.productNameSnapshot ||
    it.brandName ||
    it.productName ||
    "";

  const attrs = Array.isArray(it.attributesSnapshot)
    ? it.attributesSnapshot
        .map((a) => a?.value)
        .filter(Boolean)
        .join(" · ")
    : "";

  const spec =
    it.selectedSpecification ||
    it.specificationSnapshot ||
    attrs ||
    it.skuSnapshot ||
    "";

  return {
    brand: String(brand || ""),
    spec: String(spec || ""),
  };
}

/**
 * Downloads ONE quotation / invoice / purchase as an .xlsx file.
 */
export function downloadDocumentExcel({
  company = {},
  party = {},
  doc = {},
  items = [],
  kind = "invoice",
}) {
  const label =
    kind === "quotation"
      ? "Quotation"
      : kind === "invoice"
        ? "Invoice"
        : "Purchase";

  const prefix =
    kind === "quotation"
      ? "QTN"
      : kind === "invoice"
        ? "INV"
        : "PUR";

  const showGst = isGstEnabled(doc, items);

  const rows = [];

  // --------------------------------------------------
  // COMPANY DETAILS
  // --------------------------------------------------

  rows.push([company?.name || "Company"]);

  if (company?.address) {
    rows.push([company.address]);
  }

  if (company?.phone) {
    rows.push([`Phone: ${company.phone}`]);
  }

  if (company?.email) {
    rows.push([`Email: ${company.email}`]);
  }

  if (company?.gstin) {
    rows.push([`GSTIN: ${company.gstin}`]);
  }

  rows.push([]);

  // --------------------------------------------------
  // DOCUMENT DETAILS
  // --------------------------------------------------

  rows.push([label, doc?.number || ""]);

  rows.push([
    "Date",
    shortDate(doc?.date),
  ]);

  if (doc?.validUntil) {
    rows.push([
      "Valid Until",
      shortDate(doc.validUntil),
    ]);
  }

  if (doc?.dueDate) {
    rows.push([
      "Due Date",
      shortDate(doc.dueDate),
    ]);
  }

  rows.push([
    "Status",
    doc?.status || "",
  ]);

  rows.push([
    "Customer",
    party?.name || "",
  ]);

  if (party?.phone) {
    rows.push([
      "Phone",
      party.phone,
    ]);
  }

  if (party?.email) {
    rows.push([
      "Email",
      party.email,
    ]);
  }

  rows.push([]);

  // --------------------------------------------------
  // ITEMS HEADER
  // --------------------------------------------------

  const header = [
    "S.No",
    "Brand / Product",
    "Specification",
    "Unit",
    "Qty",
    "Rate",
    "Discount",
  ];

  if (showGst) {
    header.push(
      "Tax %",
      "Tax Amount"
    );
  }

  header.push("Total");

  rows.push(header);

  // --------------------------------------------------
  // ITEMS
  // --------------------------------------------------

  items.forEach((it, index) => {
    const { brand, spec } = describeItem(it);

    const line = [
      index + 1,
      brand,
      spec,
      it?.unit ||
        it?.unitSnapshot ||
        "",

      Number(it?.quantity) || 0,

      Number(it?.unitPrice) || 0,

      Number(it?.discount) || 0,
    ];

    if (showGst) {
      line.push(
        Number(it?.taxRate) || 0,
        Number(it?.taxAmount) || 0
      );
    }

    line.push(
      Number(it?.lineTotal) || 0
    );

    rows.push(line);
  });

  // --------------------------------------------------
  // TOTALS
  // --------------------------------------------------

  rows.push([]);

  rows.push([
    "Subtotal",
    Number(doc?.subtotal) || 0,
  ]);

  if (Number(doc?.discount) > 0) {
    rows.push([
      "Discount",
      Number(doc.discount) || 0,
    ]);
  }

  if (showGst) {
    rows.push([
      "Tax / GST",
      Number(doc?.taxTotal) || 0,
    ]);
  }

  rows.push([
    "Grand Total",
    Number(doc?.grandTotal) || 0,
  ]);

  // --------------------------------------------------
  // QUOTATION PAYMENT DETAILS
  // --------------------------------------------------

  if (
    kind === "quotation" &&
    Number(doc?.advancePayment) > 0
  ) {
    const advance =
      Number(doc.advancePayment) || 0;

    const grandTotal =
      Number(doc?.grandTotal) || 0;

    rows.push([
      "Advance Paid",
      advance,
    ]);

    rows.push([
      "Balance Due",
      Math.max(
        0,
        grandTotal - advance
      ),
    ]);
  }

  // --------------------------------------------------
  // INVOICE PAYMENT DETAILS
  // --------------------------------------------------

  if (
    kind === "invoice" &&
    doc?.amountPaid != null
  ) {
    const amountPaid =
      Number(doc.amountPaid) || 0;

    const grandTotal =
      Number(doc?.grandTotal) || 0;

    rows.push([
      "Paid",
      amountPaid,
    ]);

    rows.push([
      "Balance Due",
      Math.max(
        0,
        grandTotal - amountPaid
      ),
    ]);
  }

  // --------------------------------------------------
  // NOTES
  // --------------------------------------------------

  if (doc?.notes) {
    rows.push([]);

    rows.push([
      "Notes",
      doc.notes,
    ]);
  }

  // --------------------------------------------------
  // CREATE WORKSHEET
  // --------------------------------------------------

  const sheet =
    XLSX.utils.aoa_to_sheet(rows);

  // --------------------------------------------------
  // COLUMN WIDTHS
  // --------------------------------------------------

  sheet["!cols"] = [
    { wch: 8 },   // S.No
    { wch: 32 },  // Product
    { wch: 28 },  // Specification
    { wch: 12 },  // Unit
    { wch: 10 },  // Qty
    { wch: 14 },  // Rate
    { wch: 14 },  // Discount
    { wch: 12 },  // Tax %
    { wch: 16 },  // Tax Amount
    { wch: 16 },  // Total
  ];

  // --------------------------------------------------
  // CREATE WORKBOOK
  // --------------------------------------------------

  const book =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    book,
    sheet,
    label
  );

  // --------------------------------------------------
  // FILE NAME
  // --------------------------------------------------

  const documentNumber =
    doc?.number ||
    `${Date.now()}`;

  XLSX.writeFile(
    book,
    `${prefix}-${documentNumber}.xlsx`
  );
}

/**
 * Downloads MANY quotations / invoices / purchases as ONE .xlsx file.
 *
 * Sheet 1 "Quotations" (or "Invoices"): one row per document.
 * Sheet 2 "Line Items": one row per item, with its document number.
 *
 * Accepts `documents` or `docs`, and an optional flat `items` list and
 * `parties` list (both are looked up by id), so every list page can use it.
 */
export function downloadDocumentsExcel({
  documents,
  docs,
  items = [],
  parties = [],
  company = {},
  kind = "invoice",
}) {
  const list = Array.isArray(documents)
    ? documents
    : Array.isArray(docs)
      ? docs
      : [];

  if (list.length === 0) {
    throw new Error("No documents available to export.");
  }

  const label =
    kind === "quotation"
      ? "Quotations"
      : kind === "purchase"
        ? "Purchases"
        : "Invoices";

  const prefix =
    kind === "quotation" ? "QTN" : kind === "purchase" ? "PUR" : "INV";

  const idKey =
    kind === "quotation"
      ? "quotationId"
      : kind === "purchase"
        ? "purchaseId"
        : "invoiceId";

  const num = (value) => Number(value) || 0;
  const money = (value) => Math.round(num(value) * 100) / 100;

  const partyById = new Map(
    (Array.isArray(parties) ? parties : []).map((p) => [String(p.id), p]),
  );

  /* items grouped by document id (a doc may also carry its own items) */
  const itemsByDoc = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = String(item?.[idKey] ?? "");
    if (!key) return;
    if (!itemsByDoc.has(key)) itemsByDoc.set(key, []);
    itemsByDoc.get(key).push(item);
  });

  const itemsOf = (doc) =>
    itemsByDoc.get(String(doc?.id)) ||
    (Array.isArray(doc?.items) ? doc.items : []);

  const partyOf = (doc) =>
    doc?.party ||
    doc?.customer ||
    partyById.get(String(doc?.partyId ?? "")) ||
    {};

  const hasGst = list.some((doc) => isGstEnabled(doc, itemsOf(doc)));
  const hasPayments = kind === "invoice" || kind === "quotation";
  const paidLabel = kind === "quotation" ? "Advance Paid" : "Paid";

  /* ---------------------------------------------------------- SUMMARY SHEET */

  const rows = [];

  rows.push([company?.name || "Company"]);
  if (company?.address) rows.push([company.address]);
  if (company?.gstin) rows.push([`GSTIN: ${company.gstin}`]);
  rows.push([`${label} export`, shortDate(new Date())]);
  rows.push([]);

  const header = [
    "S.No",
    "Document No",
    "Date",
    "Customer",
    "Phone",
    "Status",
    "Items",
    "Subtotal",
    "Discount",
  ];
  if (hasGst) header.push("Tax / GST");
  header.push("Grand Total");
  if (hasPayments) header.push(paidLabel, "Balance Due");

  rows.push(header);

  const totals = { subtotal: 0, discount: 0, tax: 0, grand: 0, paid: 0, due: 0 };

  list.forEach((doc, index) => {
    const party = partyOf(doc);
    const docItems = itemsOf(doc);
    const gstOn = isGstEnabled(doc, docItems);

    const grandTotal = money(doc?.grandTotal);
    const paid = money(
      kind === "quotation" ? doc?.advancePayment : doc?.amountPaid,
    );
    const balance = Math.max(0, money(grandTotal - paid));
    const tax = gstOn ? money(doc?.taxTotal) : 0;

    totals.subtotal += money(doc?.subtotal);
    totals.discount += money(doc?.discount);
    totals.tax += tax;
    totals.grand += grandTotal;
    totals.paid += paid;
    totals.due += balance;

    const row = [
      index + 1,
      doc?.number || "",
      shortDate(doc?.date),
      party?.name || doc?.customerName || doc?.partyName || "",
      party?.phone || party?.mobile || doc?.customerPhone || "",
      doc?.status || "",
      docItems.length,
      money(doc?.subtotal),
      money(doc?.discount),
    ];
    if (hasGst) row.push(tax);
    row.push(grandTotal);
    if (hasPayments) row.push(paid, balance);

    rows.push(row);
  });

  /* totals row */
  const totalRow = ["", "TOTAL", "", "", "", "", "", money(totals.subtotal), money(totals.discount)];
  if (hasGst) totalRow.push(money(totals.tax));
  totalRow.push(money(totals.grand));
  if (hasPayments) totalRow.push(money(totals.paid), money(totals.due));
  rows.push([]);
  rows.push(totalRow);

  const summarySheet = XLSX.utils.aoa_to_sheet(rows);
  summarySheet["!cols"] = [
    { wch: 7 },
    { wch: 18 },
    { wch: 14 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 8 },
    { wch: 15 },
    { wch: 13 },
    ...(hasGst ? [{ wch: 13 }] : []),
    { wch: 16 },
    ...(hasPayments ? [{ wch: 15 }, { wch: 15 }] : []),
  ];

  /* ------------------------------------------------------- LINE ITEMS SHEET */

  const itemRows = [
    [
      "Document No",
      "Date",
      "Customer",
      "S.No",
      "Brand / Product",
      "Specification",
      "Unit",
      "Qty",
      "Rate",
      "Discount",
      ...(hasGst ? ["Tax %", "Tax Amount"] : []),
      "Line Total",
    ],
  ];

  list.forEach((doc) => {
    const party = partyOf(doc);
    const docItems = itemsOf(doc);
    const gstOn = isGstEnabled(doc, docItems);

    docItems.forEach((it, i) => {
      const { brand, spec } = describeItem(it);
      const qty = num(it?.quantity);
      const rate = num(it?.unitPrice);
      const discount = num(it?.discount);

      /* saved line total, else Qty x Rate - discount (+ tax) */
      const taxAmount = gstOn ? num(it?.taxAmount) : 0;
      const lineTotal =
        it?.lineTotal != null && it?.lineTotal !== ""
          ? money(it.lineTotal)
          : money(qty * rate - discount + taxAmount);

      itemRows.push([
        doc?.number || "",
        shortDate(doc?.date),
        party?.name || doc?.customerName || "",
        i + 1,
        brand,
        spec,
        it?.unit || it?.unitSnapshot || "",
        qty,
        rate,
        discount,
        ...(hasGst ? [gstOn ? num(it?.taxRate) : 0, taxAmount] : []),
        lineTotal,
      ]);
    });
  });

  const itemSheet = XLSX.utils.aoa_to_sheet(itemRows);
  itemSheet["!cols"] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 26 },
    { wch: 6 },
    { wch: 28 },
    { wch: 26 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 11 },
    ...(hasGst ? [{ wch: 8 }, { wch: 13 }] : []),
    { wch: 15 },
  ];

  /* ---------------------------------------------------------------- WRITE */

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, summarySheet, label);
  if (itemRows.length > 1) {
    XLSX.utils.book_append_sheet(book, itemSheet, "Line Items");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `${prefix}-All-${stamp}.xlsx`);

  return list.length;
}
