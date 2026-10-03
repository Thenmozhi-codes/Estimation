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