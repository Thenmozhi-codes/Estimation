import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Receipt,
  Package,
  Percent,
  IndianRupee,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { LineItemsEditor } from "@/components/forms/LineItemsEditor";

import { toast } from "@/lib/toast";

import {
  useCreateInvoice,
  useInvoice,
  useInvoices,
  useInvoiceItems,
  useUpdateInvoice,
} from "@/hooks/useDocuments";

import { useParties } from "@/hooks/useParties";
import { useTaxes } from "@/hooks/useMasters";

import { variantResolver } from "@/lib/api/repos";
import { mockStore } from "@/lib/store/mockStore";
import { getNextDocumentNumber } from "@/lib/utils/docNumber";
import { MODULE_TABS } from "@/app/moduleNav";

const NO_TAXES = [];

/* ==========================================================================
   HELPERS
========================================================================== */

function todayLocal() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  if (!value) return "";

  if (typeof value === "string") return value.slice(0, 10);

  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function getInvoiceIdFromParams(params) {
  return params.id || params.invoiceId || null;
}

function money(value) {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

/* Tolerant getters so the summary works with any item shape */

function getQuantity(item) {
  return Number(item?.quantity ?? item?.qty ?? 0) || 0;
}

function getUnitPrice(item) {
  return (
    Number(
      item?.unitPrice ?? item?.price ?? item?.sellingPrice ?? item?.rate ?? 0,
    ) || 0
  );
}

function getLineDiscount(item) {
  return Number(item?.discount ?? item?.discountAmount ?? 0) || 0;
}

function getLineTax(item) {
  /* Prefer an already calculated tax amount */
  if (
    item?.taxAmount !== undefined &&
    item?.taxAmount !== null &&
    item?.taxAmount !== ""
  ) {
    return Number(item.taxAmount) || 0;
  }

  const taxRate =
    Number(
      item?.taxRate ??
        item?.gstRate ??
        item?.taxPercentage ??
        item?.gstPercentage ??
        0,
    ) || 0;

  if (!taxRate) return 0;

  const taxableValue = Math.max(
    0,
    getQuantity(item) * getUnitPrice(item) - getLineDiscount(item),
  );

  return taxableValue * (taxRate / 100);
}

/* Picker fields that must survive a save, so Edit can rebuild the same row */
function lineMeta(item) {
  return {
    productType: item.productType || "",
    brandId: item.brandId || null,
    brandName: item.brandName || "",
    selectedSpecification: item.selectedSpecification || "",
    unit: item.unit || "",
    length: item.length ?? "",
    width: item.width ?? "",
    height: item.height ?? "",
    pcs: item.pcs ?? 1,
  };
}

/* Last resort when the category is missing: guess the type from the SKU prefix */
function typeFromSku(sku) {
  const text = String(sku || "");

  if (/^ply/i.test(text)) return "Plywood";
  if (/^lam/i.test(text)) return "Laminate";
  if (/^(eb|edg)/i.test(text)) return "Edge Band";
  if (/^wpc/i.test(text)) return "WPC";
  if (/^(fev|adh)/i.test(text)) return "Fevicol";
  if (/^tim/i.test(text)) return "Timber";
  if (/^bead/i.test(text)) return "Beading";
  if (/^(lb|lamb)/i.test(text)) return "Laminated Board";
  if (/^hmr/i.test(text)) return "HMR Board";
  if (/^door/i.test(text)) return "Door";

  return "";
}

/* Billing unit the Product Picker uses for each product type */
function unitForType(type) {
  const key = String(type || "").toLowerCase().replace(/[^a-z]/g, "");

  if (key === "plywood" || key === "laminate") return "sq.ft";
  if (key === "laminatedboard" || key === "hmrboard" || key === "door") return "sq.ft";
  if (key === "timber") return "cft";
  if (key === "beading") return "rft";
  if (key === "edgeband") return "rft";
  if (key === "wpc") return "cu.ft";

  return "pcs";
}

/* Product type shown in the row, taken from the brand's category */
function typeLabelFromCategory(name) {
  const text = String(name || "").trim();
  return /adhesive|fevicol/i.test(text) ? "Fevicol" : text;
}

/*
 * Saved line -> the SAME row shape the Product Picker creates on "Add Item".
 *
 * Newer lines carry the picker fields directly (productType, brandName,
 * selectedSpecification, unit, L/W/H, pcs). Older lines only have the
 * snapshot fields, so those are rebuilt from attributesSnapshot and the
 * product / brand master data.
 */
function mapSavedItem(item, index) {
  const db = mockStore.get() || {};

  const variant =
    item.variant ||
    item.matchedVariant ||
    (db.variants || []).find((v) => v.id === item.variantId) ||
    null;

  const product =
    item.product ||
    (db.products || []).find((p) => p.id === (item.productId || variant?.productId)) ||
    null;

  const brand =
    (db.brands || []).find((b) => b.id === (item.brandId || product?.brandId)) ||
    (db.brands || []).find((b) => b.name === item.productNameSnapshot) ||
    null;

  const category =
    (db.categories || []).find(
      (c) => c.id === (brand?.categoryId || product?.categoryId),
    ) || null;

  /* attributesSnapshot -> { Specification: "18mm", Unit: "sheet", ... } */
  const attrMap = {};

  (item.attributesSnapshot || []).forEach((attr) => {
    if (attr?.attributeName) attrMap[attr.attributeName] = attr.value;
  });

  const unitPrice = Number(item.unitPrice ?? item.rate ?? item.price ?? 0) || 0;
  /* Specification: saved value, else the "Specification" attribute, else the
     remaining attribute values joined the same way the picker labels them */
  const otherValues = (item.attributesSnapshot || [])
    .filter(
      (attr) =>
        attr?.value &&
        !["brand", "unit", "specification"].includes(
          String(attr.attributeName || "").toLowerCase(),
        ),
    )
    .map((attr) => attr.value)
    .join(" • ");

  const specification =
    item.selectedSpecification ||
    item.specificationSnapshot ||
    attrMap.Specification ||
    otherValues ||
    "";
  const sku = item.sku || item.skuSnapshot || variant?.sku || product?.sku || "";

  const productType =
    item.productType ||
    item.productTypeSnapshot ||
    typeLabelFromCategory(category?.name) ||
    typeFromSku(sku);

  return {
    tempId: item.tempId || item.id || `existing-invoice-item-${index}`,

    productId: item.productId || product?.id || variant?.productId || null,
    productSku: item.productSku || sku,
    categoryId: item.categoryId || brand?.categoryId || product?.categoryId || null,

    brandId: item.brandId || brand?.id || product?.brandId || null,
    brandName: item.brandName || brand?.name || item.productNameSnapshot || "",
    productName: item.productName || item.productNameSnapshot || product?.name || "",
    productType,

    variantId: item.variantId || variant?.id || null,
    variant,
    matchedVariant: variant,
    sku,

    attributeValues: { ...attrMap },
    specifications: specification
      ? [{ specification, price: unitPrice }]
      : [],
    selectedSpecification: specification,

    unit: item.unit || item.unitSnapshot || attrMap.Unit || unitForType(productType),

    length: item.length ?? "",
    width: item.width ?? "",
    height: item.height ?? "",
    pcs: item.pcs ?? 1,

    quantity: Number(item.quantity ?? item.qty ?? 1) || 1,
    unitPrice,
    rate: unitPrice,
    defaultPrice: unitPrice,

    discount: Number(item.discount ?? 0) || 0,

    taxId: item.taxId || item.tax?.id || null,
    taxRate: Number(item.taxRate ?? item.tax?.rate ?? 0) || 0,

    invoiceItemId: item.id || null,

    /* an UNCHANGED saved line keeps its variant when saved again */
    savedKey: `${item.productId || product?.id || variant?.productId || ""}|${specification}`,
  };
}

/* ==========================================================================
   SMALL UI PIECES
========================================================================== */

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
    </div>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}

function BackButton({ onClick, disabled, label = "Back" }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={disabled}>
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

/* ==========================================================================
   INVOICE FORM
========================================================================== */

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const params = useParams();

  const invoiceId = getInvoiceIdFromParams(params);
  const isEdit = Boolean(invoiceId);

  /* ------------------------------------------------------------------------
     MASTER DATA
  ------------------------------------------------------------------------ */

  const { data: parties = [] } = useParties();
  const { data: allInvoices = [] } = useInvoices();

  /* Preview of the number this invoice will get (confirmed on save) */
  const nextInvoiceNumber = useMemo(
    () => getNextDocumentNumber(allInvoices, "INV-"),
    [allInvoices],
  );

  /* ------------------------------------------------------------------------
     INVOICE DATA
  ------------------------------------------------------------------------ */

  const {
    data: invoice,
    isLoading: invoiceLoading,
    isError: invoiceError,
  } = useInvoice(invoiceId);

  /*
   * IMPORTANT: no `= []` default here.
   * A default creates a NEW empty array on every render while the query is
   * loading, which re-triggers the effect below on every render and causes
   * an endless render loop in edit mode.
   */
  const {
    data: invoiceItemsData,
    isLoading: itemsLoading,
    isError: itemsError,
  } = useInvoiceItems(invoiceId);

  /* ------------------------------------------------------------------------
     MUTATIONS
  ------------------------------------------------------------------------ */

  const createMut = useCreateInvoice();
  const updateMut = useUpdateInvoice();

  /* ------------------------------------------------------------------------
     FORM STATE
  ------------------------------------------------------------------------ */

  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("issued");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  /* GST is OFF unless the user switches it on */
  const { data: taxesData } = useTaxes();
  const taxes = taxesData || NO_TAXES;
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstTaxId, setGstTaxId] = useState("");

  /* ------------------------------------------------------------------------
     CUSTOMERS
  ------------------------------------------------------------------------ */

  const customers = parties.filter(
    (party) => party.type === "customer" || party.type === "both",
  );

  /* Tax used on every line: only when GST is switched on */
  const activeTax = useMemo(
    () =>
      gstEnabled
        ? taxes.find((tax) => String(tax.id) === String(gstTaxId)) ||
          taxes[0] ||
          null
        : null,
    [gstEnabled, gstTaxId, taxes],
  );

  const billedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        taxId: activeTax?.id || null,
        taxRate: Number(activeTax?.rate) || 0,
        taxAmount: undefined,
      })),
    [items, activeTax],
  );

  /* ------------------------------------------------------------------------
     SUMMARY

     NOTE: this hook must stay ABOVE the early returns below.
  ------------------------------------------------------------------------ */

  const summary = useMemo(() => {
    let grossSubtotal = 0;
    let lineDiscountTotal = 0;
    let taxTotal = 0;

    billedItems.forEach((item) => {
      grossSubtotal += getQuantity(item) * getUnitPrice(item);
      lineDiscountTotal += getLineDiscount(item);
      taxTotal += getLineTax(item);
    });

    const afterLineDiscount = Math.max(0, grossSubtotal - lineDiscountTotal);

    /* Header discount comes after line discounts */
    const headerDiscount = Math.min(
      Math.max(Number(discount) || 0, 0),
      afterLineDiscount,
    );

    const taxableSubtotal = Math.max(0, afterLineDiscount - headerDiscount);

    return {
      itemCount: items.length,
      grossSubtotal,
      lineDiscountTotal,
      headerDiscount,
      taxableSubtotal,
      taxTotal,
      grandTotal: taxableSubtotal + taxTotal,
    };
  }, [billedItems, items.length, discount]);

  /* ==========================================================================
     LOAD EXISTING INVOICE
  ========================================================================== */

  useEffect(() => {
    if (!isEdit) return;
    if (!invoice) return;

    setPartyId(
      String(invoice.partyId || invoice.customerId || invoice.party?.id || ""),
    );

    setDate(
      normalizeDate(invoice.date || invoice.invoiceDate || invoice.createdAt),
    );

    setDueDate(normalizeDate(invoice.dueDate));
    setStatus(invoice.status || "issued");
    setDiscount(invoice.discount ?? 0);
    setNotes(invoice.notes || "");
    setGstEnabled(
      invoice.gstEnabled !== undefined
        ? Boolean(invoice.gstEnabled)
        : Number(invoice.taxTotal) > 0,
    );
    setGstTaxId(
      invoice.gstTaxId
        ? String(invoice.gstTaxId)
        : "",
    );

    setLoaded(true);
  }, [isEdit, invoice]);

  /* ==========================================================================
     LOAD EXISTING INVOICE ITEMS

     Converts existing invoice-item records into the structure expected by
     LineItemsEditor. The Add Item / Product Picker flow is not changed.
  ========================================================================== */

  useEffect(() => {
    if (!isEdit) return;
    if (!Array.isArray(invoiceItemsData)) return;

    const mapped = invoiceItemsData.map(mapSavedItem);
    setItems(mapped);

    /* Legacy documents, or older explicit documents without a saved tax id,
       fall back to the persisted line tax for the edit form. */
    const taxed = mapped.find((row) => Number(row.taxRate) > 0);
    if (invoice?.gstEnabled === undefined) {
      setGstEnabled(Boolean(taxed));
      setGstTaxId(taxed?.taxId ? String(taxed.taxId) : "");
    } else if (invoice.gstEnabled && !invoice.gstTaxId && taxed?.taxId) {
      setGstTaxId(String(taxed.taxId));
    }
  }, [isEdit, invoiceItemsData, invoice?.gstEnabled]);

  /* ==========================================================================
     LOADING / ERROR
  ========================================================================== */

  if (isEdit && (invoiceError || itemsError)) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title={<span className="text-base font-bold">Edit Invoice</span>}
          description="Unable to load this invoice"
          actions={<BackButton onClick={() => navigate("/bills/invoices")} />}
        />

        <ModuleTabs tabs={MODULE_TABS.bills} />

        <div className="p-6">
          <div className="rounded-xl border border-line bg-surface p-4 text-sm font-semibold text-red-500">
            Could not load this invoice.
          </div>
        </div>
      </div>
    );
  }

  if (isEdit && (invoiceLoading || itemsLoading || !loaded)) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title={<span className="text-base font-bold">Edit Invoice</span>}
          description="Loading invoice details..."
          actions={<BackButton onClick={() => navigate("/bills/invoices")} />}
        />

        <ModuleTabs tabs={MODULE_TABS.bills} />

        <div className="flex min-h-[300px] items-center justify-center p-6">
          <div className="text-sm font-semibold text-muted">
            Loading invoice…
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================================
     SAVE / UPDATE
  ========================================================================== */

  const handleSave = async () => {
    if (!items.length) {
      toast.error("Add at least one item");
      return;
    }

    const invalidItemIndex = items.findIndex(
      (item) => !(item.productId || item.product?.id) && !item.variantId,
    );

    if (invalidItemIndex !== -1) {
      toast.error(
        `Item ${invalidItemIndex + 1} is missing its Product Master reference. Please remove it and add the item again.`,
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * Resolve variants exactly like the existing New Invoice flow.
       * Existing variant IDs are preserved when possible.
       */
      /* no customer chosen -> the global Walk-in Customer */

      const enrichedItems = await Promise.all(
        items.map(async (item) => {
          const productId = item.productId || item.product?.id || null;

          const base = {
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            discount: Number(item.discount) || 0,
            taxId: activeTax?.id || null,
            ...lineMeta(item),
          };

          /* ProductPicker already gives us the selected/matched variant.
             Preserve it so custom Brand specifications do not materialize fake
             attribute variants. Legacy rows without a variant still resolve. */
          if (item.variantId) {
            return { variantId: item.variantId, ...base };
          }

          const variant = await variantResolver.resolveOrCreate({
            productId,
            defaultSku: item.productSku || item.sku,
            attributeValues: item.attributeValues || {},
          });

          return { variantId: variant.id, ...base };
        }),
      );

      const payload = {
        partyId: partyId || null,
        customerName: partyId
          ? customers.find((party) => String(party.id) === String(partyId))?.name || ""
          : "",
        gstEnabled: Boolean(gstEnabled),
        gstPercentage: gstEnabled ? Number(activeTax?.rate) || 0 : 0,
        gstTaxId: gstEnabled ? activeTax?.id || null : null,
        date,
        dueDate: dueDate || null,
        status,
        discount: Number(discount) || 0,
        notes,
        items: enrichedItems,
      };

      /* CREATE */
      if (!isEdit) {
        const created = await createMut.mutateAsync(payload);

        toast.success(`Invoice ${created.number} created`);
        navigate(`/bills/invoices/${created.id}`);

        return;
      }

      /* UPDATE */
      const updated = await updateMut.mutateAsync({
        id: invoiceId,
        patch: payload,
      });

      toast.success(
        `Invoice ${updated?.number || invoice?.number || ""} updated`,
      );

      navigate(`/bills/invoices/${invoiceId}`);
    } catch (error) {
      console.error("Invoice save failed:", error);

      toast.error(error?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================================
     UI
  ========================================================================== */

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title={
          <span className="text-lg font-bold">
            {isEdit ? "Edit Invoice" : "New Invoice"}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <BackButton
              label="Cancel"
              disabled={saving}
              onClick={() =>
                navigate(
                  isEdit ? `/bills/invoices/${invoiceId}` : "/bills/invoices",
                )
              }
            />

            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !items.length}
            >
              <Save className="h-4 w-4" />

              {saving ? "Saving…" : isEdit ? "Update Invoice" : "Save Invoice"}
            </Button>
          </div>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.bills} />

      <div className="w-full p-4 pb-28 md:p-6">
        {/* ONE FORM CARD: form sections on the left, full-height summary on the right */}
        <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-sm lg:flex-row">
          {/* ============================ LEFT — FORM ============================ */}
          <div className="min-w-0 flex-1 divide-y divide-line">
            {/* DETAILS */}
            <section className="p-4 md:p-5">
              <SectionHeading title="Invoice Details" />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Invoice No.">
                  <Input
                    value={isEdit ? invoice?.number || "" : nextInvoiceNumber}
                    readOnly
                    disabled
                  />
                </Field>

                <Field label="Customer">
                  <SearchableSelect
                    value={partyId}
                    onChange={setPartyId}
                    options={[...customers]
                        .sort((a, b) => Number(Boolean(b.isGlobal)) - Number(Boolean(a.isGlobal)))
                        .map((party) => ({
                      value: String(party.id),
                      label: party.name,
                    }))}
                    placeholder="Select customer (optional)"
                    searchPlaceholder="Search customer…"
                    emptyText="No customers found"
                  />
                </Field>

                <Field label="Status">
                  <SearchableSelect
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: "draft", label: "Draft" },
                      { value: "issued", label: "Issued" },
                      /* show the current status (e.g. Paid) instead of a blank box */
                      ...(["partially_paid", "paid", "overdue", "cancelled"].includes(status)
                        ? [
                            {
                              value: status,
                              label: status
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c) => c.toUpperCase()),
                            },
                          ]
                        : []),
                    ]}
                    placeholder="Select status…"
                  />
                </Field>

                <Field label="Date">
                  <Input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>

                <Field label="Due Date">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </Field>
              </div>
            </section>

            {/* ITEMS */}
            <section className="p-4 md:p-5">
              <SectionHeading title="Items" />

              <LineItemsEditor items={items} onChange={setItems} />
            </section>

            {/* GST — chosen from Settings → Tax Rates */}
            <section className="p-4 md:p-5">
              <div className="max-w-xs">
                <Field label="GST">
                  <Select
                    value={gstEnabled ? String(activeTax?.id ?? "") : ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGstTaxId(value);
                      setGstEnabled(Boolean(value));
                    }}
                  >
                    <option value="">No GST</option>
                    {taxes.map((tax) => (
                      <option key={tax.id} value={String(tax.id)}>
                        {tax.name || "GST"} {Number(tax.rate) || 0}%
                      </option>
                    ))}
                  </Select>
                </Field>

                {!taxes.length && (
                  <div className="mt-1 text-xs text-muted">
                    No tax rates yet. Add them in Settings → Tax.
                  </div>
                )}
              </div>
            </section>

            {/* DISCOUNT + NOTES */}
            <section className="p-4 md:p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Header discount">
                  <MoneyInput
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                  />
                </Field>

                <Field label="Notes">
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              </div>
            </section>
          </div>

          {/* ============ RIGHT — SUMMARY (full height, ~20%, follows the scroll) ============ */}
          <aside className="rounded-b-2xl border-t border-line bg-bg/40 lg:w-1/5 lg:min-w-[260px] lg:rounded-b-none lg:rounded-r-2xl lg:border-l lg:border-t-0">
            <div className="lg:sticky lg:top-4">
              {/* Header */}
              <div className="flex items-center gap-2 border-b border-line px-4 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Receipt className="h-4 w-4 text-primary" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Invoice Summary
                  </h3>
                </div>
              </div>

              {/* Item count */}
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Package className="h-4 w-4" />
                  Items
                </div>
                <span className="font-semibold text-ink">
                  {summary.itemCount}
                </span>
              </div>

              {/* Amounts */}
              <div className="space-y-3 px-4 py-4">
                <SummaryRow label="Subtotal">
                  <span className="text-sm font-medium text-ink">
                    {money(summary.grossSubtotal)}
                  </span>
                </SummaryRow>

                {summary.lineDiscountTotal > 0 && (
                  <SummaryRow label="Item Discount">
                    <span className="text-sm font-medium text-red-600">
                      - {money(summary.lineDiscountTotal)}
                    </span>
                  </SummaryRow>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted">Discount</span>
                    {summary.headerDiscount > 0 && (
                      <Percent className="h-3 w-3 text-muted" />
                    )}
                  </div>

                  <span
                    className={
                      summary.headerDiscount > 0
                        ? "text-sm font-medium text-red-600"
                        : "text-sm text-muted"
                    }
                  >
                    {summary.headerDiscount > 0
                      ? `- ${money(summary.headerDiscount)}`
                      : money(0)}
                  </span>
                </div>

                {gstEnabled && (
                  <SummaryRow
                    label={`GST${activeTax ? ` (${Number(activeTax.rate) || 0}%)` : ""}`}
                  >
                    <span className="text-sm font-medium text-ink">
                      {money(summary.taxTotal)}
                    </span>
                  </SummaryRow>
                )}

                {/* Grand total */}
                <div className="border-t border-dashed border-line pt-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted">Grand Total</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {gstEnabled ? "Including GST" : "No GST"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-lg font-bold text-ink">
                      <IndianRupee className="h-4 w-4" />
                      <span>
                        {Number(summary.grandTotal).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default InvoiceFormPage;