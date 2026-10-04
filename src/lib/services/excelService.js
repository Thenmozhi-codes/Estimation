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

function describeItem(it) {
  const brand = it.productNameSnapshot || it.brandName || it.productName || "";

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

/**
 * Downloads ONE quotation / invoice / purchase as an .xlsx file.
 */
export function downloadDocumentExcel({ company, party, doc, items = [], kind }) {
  const label =
    kind === "quotation" ? "Quotation" : kind === "invoice" ? "Invoice" : "Purchase";
  const prefix =
    kind === "quotation" ? "QTN" : kind === "invoice" ? "INV" : "PUR";

  const showGst = isGstEnabled(doc, items);

  const rows = [];

  rows.push([company?.name || "Company"]);
  if (company?.address) rows.push([company.address]);
  if (company?.gstin) rows.push([`GSTIN: ${company.gstin}`]);
  rows.push([]);

  rows.push([label, doc.number || ""]);
  rows.push(["Date", shortDate(doc.date)]);
  if (doc.validUntil) rows.push(["Valid Until", shortDate(doc.validUntil)]);
  if (doc.dueDate) rows.push(["Due Date", shortDate(doc.dueDate)]);
  rows.push(["Status", doc.status || ""]);
  rows.push(["Customer", party?.name || ""]);
  if (party?.phone) rows.push(["Phone", party.phone]);
  rows.push([]);

  const header = [
    "S.No",
    "Brand / Product",
    "Specification",
    "Unit",
    "Qty",
    "Rate",
    "Discount",
  ];
  if (showGst) header.push("Tax %", "Tax Amount");
  header.push("Total");
  rows.push(header);

  items.forEach((it, index) => {
    const { brand, spec } = describeItem(it);

    const line = [
      index + 1,
      brand,
      spec,
      it.unit || it.unitSnapshot || "",
      Number(it.quantity) || 0,
      Number(it.unitPrice) || 0,
      Number(it.discount) || 0,
    ];

    if (showGst) {
      line.push(Number(it.taxRate) || 0, Number(it.taxAmount) || 0);
    }

    line.push(Number(it.lineTotal) || 0);
    rows.push(line);
  });

  rows.push([]);
  rows.push(["Subtotal", Number(doc.subtotal) || 0]);
  if ((doc.discount || 0) > 0) rows.push(["Discount", Number(doc.discount) || 0]);
  if (showGst) rows.push(["Tax / GST", Number(doc.taxTotal) || 0]);
  rows.push(["Grand Total", Number(doc.grandTotal) || 0]);

  if (kind === "invoice" && doc.amountPaid != null) {
    rows.push(["Paid", Number(doc.amountPaid) || 0]);
    rows.push([
      "Balance Due",
      Math.max(0, (doc.grandTotal || 0) - (doc.amountPaid || 0)),
    ]);
  }

  if (doc.notes) {
    rows.push([]);
    rows.push(["Notes", doc.notes]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 24 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, label);
  XLSX.writeFile(book, `${prefix}-${doc.number}.xlsx`);
}

/* ───────────────────────── EXPORT ALL (list pages) ───────────────────────── */

const stamp = () => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
};

const DOC_KEY = {
  quotation: "quotationId",
  invoice: "invoiceId",
  purchase: "purchaseId",
};

/**
 * Downloads MANY quotations / invoices / purchases as one .xlsx file.
 *   Sheet 1 "Summary" — one row per document
 *   Sheet 2 "Items"   — every line item, with its document number
 *
 * @param {object} opts
 *   company — company record
 *   parties — all parties (used to show customer names)
 *   docs    — the documents to export (usually the filtered list)
 *   items   — line items of those documents
 *   kind    — 'quotation' | 'invoice' | 'purchase'
 */
export function downloadDocumentsExcel({
  company,
  parties = [],
  docs = [],
  items = [],
  kind,
}) {
  const isInvoice = kind === "invoice";
  const isQuotation = kind === "quotation";

  const label = isQuotation ? "Quotations" : isInvoice ? "Invoices" : "Purchases";
  const idKey = DOC_KEY[kind] || "documentId";

  const partyById = Object.fromEntries(parties.map((party) => [party.id, party]));

  const itemsByDoc = {};
  items.forEach((item) => {
    (itemsByDoc[item[idKey]] ||= []).push(item);
  });

  /* ───── Summary sheet ───── */
  const summary = [];

  summary.push([company?.name || "Company"]);
  summary.push([`All ${label}`]);
  summary.push(["Exported on", shortDate(new Date())]);
  summary.push(["Documents", docs.length]);
  summary.push([]);

  const header = [
    "S.No",
    "Number",
    "Date",
    isQuotation ? "Valid Until" : "Due Date",
    "Customer",
    "Phone",
    "Status",
    "Items",
    "Subtotal",
    "Discount",
    "GST",
    "Grand Total",
  ];
  if (isInvoice) header.push("Paid", "Balance");
  summary.push(header);

  const totals = { subtotal: 0, discount: 0, tax: 0, grand: 0, paid: 0, balance: 0 };

  docs.forEach((doc, index) => {
    const party = partyById[doc.partyId];
    const docItems = itemsByDoc[doc.id] || [];
    const gstOn = isGstEnabled(doc, docItems);

    const subtotal = Number(doc.subtotal) || 0;
    const discount = Number(doc.discount) || 0;
    const tax = gstOn ? Number(doc.taxTotal) || 0 : 0;
    const grand = Number(doc.grandTotal) || 0;
    const paid = Number(doc.amountPaid) || 0;
    const balance = Math.max(0, grand - paid);

    totals.subtotal += subtotal;
    totals.discount += discount;
    totals.tax += tax;
    totals.grand += grand;
    totals.paid += paid;
    totals.balance += balance;

    const row = [
      index + 1,
      doc.number || "",
      shortDate(doc.date),
      shortDate(isQuotation ? doc.validUntil : doc.dueDate),
      party?.name || "",
      party?.phone || "",
      doc.status || "",
      docItems.length,
      subtotal,
      discount,
      tax,
      grand,
    ];
    if (isInvoice) row.push(paid, balance);

    summary.push(row);
  });

  const totalRow = ["", "TOTAL", "", "", "", "", "", "", totals.subtotal, totals.discount, totals.tax, totals.grand];
  if (isInvoice) totalRow.push(totals.paid, totals.balance);
  summary.push([]);
  summary.push(totalRow);

  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
  ];

  /* ───── Items sheet ───── */
  const lines = [
    [
      "Number",
      "Date",
      "Customer",
      "S.No",
      "Brand / Product",
      "Specification",
      "Unit",
      "Qty",
      "Rate",
      "Discount",
      "Tax %",
      "Tax Amount",
      "Total",
    ],
  ];

  docs.forEach((doc) => {
    const party = partyById[doc.partyId];
    const docItems = itemsByDoc[doc.id] || [];
    const gstOn = isGstEnabled(doc, docItems);

    docItems.forEach((it, index) => {
      const { brand, spec } = describeItem(it);

      lines.push([
        doc.number || "",
        shortDate(doc.date),
        party?.name || "",
        index + 1,
        brand,
        spec,
        it.unit || it.unitSnapshot || "",
        Number(it.quantity) || 0,
        Number(it.unitPrice) || 0,
        Number(it.discount) || 0,
        gstOn ? Number(it.taxRate) || 0 : 0,
        gstOn ? Number(it.taxAmount) || 0 : 0,
        Number(it.lineTotal) || 0,
      ]);
    });
  });

  const itemsSheet = XLSX.utils.aoa_to_sheet(lines);
  itemsSheet["!cols"] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
    { wch: 6 },
    { wch: 30 },
    { wch: 24 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(book, itemsSheet, "Items");
  XLSX.writeFile(book, `${label}-${stamp()}.xlsx`);
}