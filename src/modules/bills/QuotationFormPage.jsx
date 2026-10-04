import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Save,
  User,
  Phone,
  Package,
  Receipt,
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
  useCreateQuotation,
  useQuotation,
  useQuotationItems,
  useQuotations,
  useUpdateQuotation,
} from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { useTaxes } from "@/hooks/useMasters";
import { variantResolver } from "@/lib/api/repos";
import { mockStore } from "@/lib/store/mockStore";
import { getNextDocumentNumber } from "@/lib/utils/docNumber";
import { MODULE_TABS } from "@/app/moduleNav";

const NO_TAXES = [];

/* -------------------------------------------------------------------------- */
/* DRAFT STORAGE (new quotations only)                                        */
/* -------------------------------------------------------------------------- */

const QUOTATION_DRAFT_KEY = "timber-erp-quotation-draft-v1";

function loadQuotationDraft() {
  try {
    const raw = localStorage.getItem(QUOTATION_DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw);
    return draft && typeof draft === "object" ? draft : null;
  } catch (error) {
    console.error("Failed to load quotation draft:", error);
    return null;
  }
}

function saveQuotationDraft(draft) {
  try {
    localStorage.setItem(QUOTATION_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch (error) {
    console.error("Failed to save quotation draft:", error);
    return false;
  }
}

function clearQuotationDraft() {
  try {
    localStorage.removeItem(QUOTATION_DRAFT_KEY);
  } catch (error) {
    console.error("Failed to clear quotation draft:", error);
  }
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function money(value) {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
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
    tempId: item.tempId || item.id || `existing-quotation-item-${index}`,

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

    quotationItemId: item.id || null,

    /* an UNCHANGED saved line keeps its variant when saved again */
    savedKey: `${item.productId || product?.id || variant?.productId || ""}|${specification}`,
  };
}

/* -------------------------------------------------------------------------- */
/* SMALL UI PIECES                                                            */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export function QuotationFormPage() {
  const navigate = useNavigate();
  const params = useParams();

  const quotationId = params.id || null;
  const isEdit = Boolean(quotationId);

  const { data: parties = [] } = useParties();
  const { data: quotations = [] } = useQuotations();

  /* Existing quotation (edit mode only — the hooks are disabled without an id).
     No `= []` default on items: a new array every render would re-trigger
     the effect below on every render while the query is loading. */
  const {
    data: quotation,
    isLoading: quotationLoading,
    isError: quotationError,
  } = useQuotation(quotationId);

  const {
    data: savedItems,
    isLoading: itemsLoading,
    isError: itemsError,
  } = useQuotationItems(quotationId);

  const createMut = useCreateQuotation();
  const updateMut = useUpdateQuotation();

  const today = new Date().toISOString().slice(0, 10);

  /* STATE */
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(today);
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

  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  /* Stops the initial empty state from overwriting an existing draft */
  const [draftLoaded, setDraftLoaded] = useState(false);

  /* RESTORE DRAFT — new quotations only */
  useEffect(() => {
    if (isEdit) return;

    const draft = loadQuotationDraft();

    if (draft) {
      setPartyId(draft.partyId || "");
      setDate(draft.date || today);
      setDiscount(draft.discount ?? 0);
      setNotes(draft.notes || "");
      setItems(Array.isArray(draft.items) ? draft.items : []);
      setGstEnabled(Boolean(draft.gstEnabled));
      setGstTaxId(draft.gstTaxId || "");

      setDraftRestored(true);
      setDraftLoaded(true);

      const timer = setTimeout(() => setDraftRestored(false), 2500);
      return () => clearTimeout(timer);
    }

    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  /* AUTO SAVE DRAFT — new quotations only */
  useEffect(() => {
    if (isEdit || !draftLoaded) return;

    const saved = saveQuotationDraft({
      partyId,
      date,
      discount,
      notes,
      items,
      gstEnabled,
      gstTaxId,
      updatedAt: new Date().toISOString(),
    });

    if (!saved) return;

    setDraftSaved(true);

    const timer = setTimeout(() => setDraftSaved(false), 1200);
    return () => clearTimeout(timer);
  }, [isEdit, draftLoaded, partyId, date, discount, notes, items, gstEnabled, gstTaxId]);

  /* LOAD EXISTING QUOTATION */
  useEffect(() => {
    if (!isEdit || !quotation) return;

    setPartyId(
      String(quotation.partyId || quotation.customerId || quotation.party?.id || ""),
    );
    setDate(
      normalizeDate(quotation.date || quotation.quotationDate || quotation.createdAt),
    );
    setDiscount(quotation.discount ?? 0);
    setNotes(quotation.notes || "");
    setGstEnabled(
      quotation.gstEnabled !== undefined
        ? Boolean(quotation.gstEnabled)
        : Number(quotation.taxTotal) > 0,
    );
    setGstTaxId(
      quotation.gstTaxId
        ? String(quotation.gstTaxId)
        : "",
    );

    setLoaded(true);
  }, [isEdit, quotation]);

  /* LOAD EXISTING ITEMS */
  useEffect(() => {
    if (!isEdit || !Array.isArray(savedItems)) return;

    const mapped = savedItems.map(mapSavedItem);
    setItems(mapped);

    /* Legacy documents, or older explicit documents without a saved tax id,
       fall back to the persisted line tax for the edit form. */
    const taxed = mapped.find((row) => Number(row.taxRate) > 0);
    if (quotation?.gstEnabled === undefined) {
      setGstEnabled(Boolean(taxed));
      setGstTaxId(taxed?.taxId ? String(taxed.taxId) : "");
    } else if (quotation.gstEnabled && !quotation.gstTaxId && taxed?.taxId) {
      setGstTaxId(String(taxed.taxId));
    }
  }, [isEdit, savedItems, quotation?.gstEnabled]);

  /* CUSTOMERS */
  const customers = useMemo(
    () =>
      parties.filter(
        (party) => party.type === "customer" || party.type === "both",
      ),
    [parties],
  );

  const selectedCustomer = useMemo(
    () =>
      customers.find((party) => String(party.id) === String(partyId)) || null,
    [customers, partyId],
  );

  const customerMobile =
    selectedCustomer?.mobile ||
    selectedCustomer?.phone ||
    selectedCustomer?.mobileNumber ||
    selectedCustomer?.phoneNumber ||
    "";

  /* Preview of the number a NEW quotation will get (real one set on save) */
  const nextNumber = useMemo(
    () => getNextDocumentNumber(quotations, "QT-"),
    [quotations],
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

  /* SUMMARY — must stay above the early returns below */
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

  /* LOADING / ERROR (edit mode) */
  if (isEdit && (quotationError || itemsError)) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title={<span className="text-base font-bold">Edit Quotation</span>}
          actions={<BackButton onClick={() => navigate("/bills/quotations")} />}
        />

        <ModuleTabs tabs={MODULE_TABS.bills} />

        <div className="p-6">
          <div className="rounded-xl border border-line bg-surface p-4 text-sm font-semibold text-red-500">
            Could not load this quotation.
          </div>
        </div>
      </div>
    );
  }

  if (isEdit && (quotationLoading || itemsLoading || !loaded)) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title={<span className="text-base font-bold">Edit Quotation</span>}
          actions={<BackButton onClick={() => navigate("/bills/quotations")} />}
        />

        <ModuleTabs tabs={MODULE_TABS.bills} />

        <div className="flex min-h-[300px] items-center justify-center p-6">
          <div className="text-sm font-semibold text-muted">
            Loading quotation…
          </div>
        </div>
      </div>
    );
  }

  /* SAVE / UPDATE */
  const handleSave = async () => {
    if (!items.length) {
      toast.error("Add at least one item");
      return;
    }

    const normalizedItems = items.map((item) => ({
      ...item,
      productId: item?.productId || item?.product?.id || null,
    }));

    /* An existing line may only carry its variantId — that is fine */
    const invalidItemIndex = normalizedItems.findIndex(
      (item) => !item.productId && !item.variantId,
    );

    if (invalidItemIndex !== -1) {
      toast.error(
        `Item ${invalidItemIndex + 1} is missing its Product Master reference. Please remove it and add the item again.`,
      );
      return;
    }

    setSaving(true);

    try {
      const enrichedItems = await Promise.all(
        normalizedItems.map(async (item) => {
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
            productId: item.productId,
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
        discount: Number(discount) || 0,
        notes,
        items: enrichedItems,
      };

      /* UPDATE */
      if (isEdit) {
        const updated = await updateMut.mutateAsync({
          id: quotationId,
          patch: payload,
        });

        toast.success(
          `Quotation ${updated?.number || quotation?.number || ""} updated`,
        );
        navigate(`/bills/quotations/${quotationId}`);
        return;
      }

      /* CREATE */
      const created = await createMut.mutateAsync(payload);

      /* Only clear the draft AFTER the quotation was really created */
      clearQuotationDraft();

      toast.success(`Quotation ${created.number} created`);
      navigate(`/bills/quotations/${created.id}`);
    } catch (error) {
      console.error("Quotation save failed:", error);
      toast.error(error?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title={
          <span className="text-lg font-bold">
            {isEdit ? "Edit Quotation" : "New Quotation"}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <BackButton
              label="Cancel"
              disabled={saving}
              onClick={() =>
                navigate(
                  isEdit
                    ? `/bills/quotations/${quotationId}`
                    : "/bills/quotations",
                )
              }
            />

            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving
                ? "Saving…"
                : isEdit
                  ? "Update Quotation"
                  : "Save Quotation"}
            </Button>
          </div>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.bills} />

      <div className="w-full p-4 pb-28 md:p-6">
        {/* Draft status (new quotations only) */}
        {!isEdit && (draftRestored || draftSaved) && (
          <div className="mb-4 flex justify-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted shadow-sm">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  draftRestored ? "bg-emerald-500" : "bg-primary"
                }`}
              />
              {draftRestored
                ? "Previous draft restored"
                : "Draft saved automatically"}
            </div>
          </div>
        )}

        <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-sm lg:flex-row">
          {/* ============================ LEFT — FORM ============================ */}
          <div className="min-w-0 flex-1 divide-y divide-line">
            {/* DETAILS */}
            <section className="p-4 md:p-5">
              <SectionHeading title="Quotation Details" />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Quotation No.">
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={isEdit ? quotation?.number || "" : nextNumber}
                      readOnly
                      disabled
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field label="Date" required>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field label="Customer Name">
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
                    <SearchableSelect
                      value={partyId}
                      onChange={setPartyId}
                      options={[...customers]
                        .sort((a, b) => Number(Boolean(b.isGlobal)) - Number(Boolean(a.isGlobal)))
                        .map((customer) => ({
                        value: String(customer.id),
                        label: customer.name,
                      }))}
                      placeholder="Select customer (optional)"
                      searchPlaceholder="Search customer…"
                      emptyText="No customers found"
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field label="Customer Mobile">
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={customerMobile}
                      readOnly
                      placeholder="Customer mobile number"
                      className="pl-9"
                    />
                  </div>
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

          {/* ================== RIGHT — SUMMARY ================== */}
          <aside className="rounded-b-2xl border-t border-line bg-bg/40 lg:w-1/5 lg:min-w-[260px] lg:rounded-b-none lg:rounded-r-2xl lg:border-l lg:border-t-0">
            <div className="lg:sticky lg:top-4">
              <div className="flex items-center gap-2 border-b border-line px-4 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Receipt className="h-4 w-4 text-primary" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Quotation Summary
                  </h3>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Package className="h-4 w-4" />
                  Items
                </div>
                <span className="font-semibold text-ink">
                  {summary.itemCount}
                </span>
              </div>

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

export default QuotationFormPage;