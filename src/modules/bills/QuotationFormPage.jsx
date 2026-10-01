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
import { variantResolver } from "@/lib/api/repos";
import { getNextDocumentNumber } from "@/lib/utils/docNumber";
import { MODULE_TABS } from "@/app/moduleNav";

/* -------------------------------------------------------------------------- */
/* DRAFT STORAGE                                                              */
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
    localStorage.setItem(
      QUOTATION_DRAFT_KEY,
      JSON.stringify(draft),
    );

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

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

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
      item?.unitPrice ??
        item?.price ??
        item?.sellingPrice ??
        item?.rate ??
        0,
    ) || 0
  );
}

function getLineDiscount(item) {
  return Number(
    item?.discount ??
      item?.discountAmount ??
      0,
  ) || 0;
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
    getQuantity(item) * getUnitPrice(item) -
      getLineDiscount(item),
  );

  return taxableValue * (taxRate / 100);
}

/* -------------------------------------------------------------------------- */
/* ATTRIBUTE SNAPSHOT HELPERS                                                 */
/* -------------------------------------------------------------------------- */

/* ===== CHANGED (NEW): tolerate JSON strings, plain objects, arrays ===== */

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;

  const text = value.trim();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toText(value) {
  if (value === undefined || value === null) return "";

  if (typeof value === "object") {
    return toText(
      value.label ?? value.name ?? value.value ?? "",
    );
  }

  return String(value).trim();
}

/* Always returns an array of attribute objects */
function normalizeAttributes(raw) {
  const parsed = parseMaybeJson(raw);

  if (Array.isArray(parsed)) return parsed.filter(Boolean);

  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed).map(([key, value]) => ({
      key,
      value,
    }));
  }

  return [];
}

/* ===== END NEW HELPERS ===== */

function attributesToValues(list) {
  if (!Array.isArray(list)) return {};

  return list.reduce((acc, attr, index) => {
    if (
      !attr ||
      attr.value === undefined ||
      attr.value === null
    ) {
      return acc;
    }

    const key =
      attr.key ||
      attr.code ||
      attr.attributeId ||
      attr.id ||
      attr.name ||
      attr.label ||
      `attr${index}`;

    acc[key] = attr.value;

    return acc;
  }, {});
}

/*
 * Extract the actual specification value from a saved snapshot.
 *
 * CHANGED: now uses normalizeAttributes() so JSON strings and plain
 * objects work as well as arrays.
 */
function getSpecificationFromSnapshot(attributesSnapshot) {
  const list = normalizeAttributes(attributesSnapshot);

  if (!list.length) return "";

  /* First look specifically for Specification */
  const explicit = list.find((attr) => {
    const key = String(
      attr.key ??
        attr.name ??
        attr.label ??
        attr.code ??
        "",
    )
      .trim()
      .toLowerCase();

    return (
      key === "specification" ||
      key === "specifications"
    );
  });

  const explicitText = toText(explicit?.value);

  if (explicitText) return explicitText;

  /* Fallback: first meaningful snapshot value (Thickness, Size, ...) */
  for (const attr of list) {
    const text = toText(attr.value);

    if (text) return text;
  }

  return "";
}

/* -------------------------------------------------------------------------- */
/* EXISTING QUOTATION ITEM → LINE ITEMS EDITOR ROW                            */
/* -------------------------------------------------------------------------- */

/*
 * Saved quotation items can contain snapshot fields:
 *
 * productNameSnapshot
 * skuSnapshot
 * attributesSnapshot
 *
 * The editor expects:
 *
 * productName
 * sku
 * attributeValues
 * selectedSpecification
 *
 * LineItemsEditor's SpecificationField displays item.selectedSpecification
 * first, then item.specifications[].specification.
 */
function mapSavedItem(item, index) {
  const variant =
    item?.variant ||
    item?.matchedVariant ||
    null;

  const product =
    item?.product ||
    variant?.product ||
    null;

  /* ---------------------------------------------------------------------- */
  /* IDS                                                                     */
  /* ---------------------------------------------------------------------- */

  const productId =
    item?.productId ||
    product?.id ||
    variant?.productId ||
    null;

  const variantId =
    item?.variantId ||
    variant?.id ||
    null;

  /* ---------------------------------------------------------------------- */
  /* PRODUCT NAME                                                            */
  /* ---------------------------------------------------------------------- */

  const productName =
    item?.productName ||
    item?.productNameSnapshot ||
    product?.name ||
    item?.name ||
    variant?.productName ||
    "";

  /* ---------------------------------------------------------------------- */
  /* BRAND                                                                   */
  /* ---------------------------------------------------------------------- */

  const brandName =
    item?.brandName ||
    item?.brandNameSnapshot ||
    product?.brandName ||
    product?.brand?.name ||
    item?.brand?.name ||
    "";

  /* ---------------------------------------------------------------------- */
  /* PRODUCT TYPE                                                            */
  /* ---------------------------------------------------------------------- */

  const productType =
    item?.productType ||
    item?.productTypeSnapshot ||
    product?.productType ||
    product?.category?.name ||
    item?.category?.name ||
    "";

  /* ---------------------------------------------------------------------- */
  /* SKU                                                                     */
  /* ---------------------------------------------------------------------- */

  const sku =
    item?.sku ||
    item?.skuSnapshot ||
    item?.productSku ||
    variant?.sku ||
    product?.sku ||
    "";

  /* ---------------------------------------------------------------------- */
  /* SNAPSHOT ATTRIBUTES                                                     */
  /* ---------------------------------------------------------------------- */

  /* CHANGED: normalize string / object / array snapshots into an array */
  const attributesSnapshot = normalizeAttributes(
    item?.attributesSnapshot,
  );

  const snapshotAttributeValues =
    attributesToValues(attributesSnapshot);

  /* CHANGED: an empty {} is truthy, so check for real keys */
  const hasKeys = (obj) =>
    !!obj &&
    typeof obj === "object" &&
    Object.keys(obj).length > 0;

  const attributeValues = hasKeys(item?.attributeValues)
    ? item.attributeValues
    : hasKeys(variant?.attributeValues)
      ? variant.attributeValues
      : snapshotAttributeValues;

  /* ---------------------------------------------------------------------- */
  /* SPECIFICATIONS                                                          */
  /* ---------------------------------------------------------------------- */

  const specifications = Array.isArray(
    item?.specifications,
  )
    ? item.specifications
    : Array.isArray(variant?.specifications)
      ? variant.specifications
      : [];

  const snapshotSpecification =
    getSpecificationFromSnapshot(
      attributesSnapshot,
    );

  /* CHANGED: toText on each source, plus item.specificationValue */
  const selectedSpecification =
    toText(item?.selectedSpecification) ||
    toText(item?.specificationSnapshot) ||
    toText(item?.specification) ||
    toText(item?.specificationValue) ||
    snapshotSpecification ||
    toText(Object.values(attributeValues || {})[0]) ||
    "";

  /* ---------------------------------------------------------------------- */
  /* PRICE                                                                   */
  /* ---------------------------------------------------------------------- */

  const unitPrice =
    Number(
      item?.unitPrice ??
        item?.rate ??
        item?.price ??
        0,
    ) || 0;

  /* ---------------------------------------------------------------------- */
  /* FINAL EDITOR ROW                                                        */
  /* ---------------------------------------------------------------------- */

  return {
    tempId:
      item?.tempId ||
      item?.id ||
      `existing-quotation-item-${index}`,

    productId,

    productSku:
      item?.productSku ||
      sku,

    productName,

    productType,

    /* Preserve snapshot fields */
    productNameSnapshot:
      item?.productNameSnapshot ||
      productName,

    skuSnapshot:
      item?.skuSnapshot ||
      sku,

    attributesSnapshot,

    /* Brand */
    brandId:
      item?.brandId ||
      product?.brandId ||
      product?.brand?.id ||
      null,

    brandName,

    /* Variant */
    variantId,

    variant,

    matchedVariant:
      item?.matchedVariant ||
      variant ||
      null,

    sku,

    /* Specification / attributes */
    attributeValues,

    specifications,

    selectedSpecification,

    /* Unit */
    unit:
      item?.unit ||
      item?.unitSnapshot ||
      variant?.unit ||
      product?.unit ||
      "",

    /* Dimensions */
    length: item?.length ?? "",
    width: item?.width ?? "",
    height: item?.height ?? "",
    pcs: item?.pcs ?? 1,

    /* Quantity */
    quantity:
      Number(
        item?.quantity ??
          item?.qty ??
          1,
      ) || 1,

    /* Price */
    unitPrice,

    rate: unitPrice,

    defaultPrice: unitPrice,

    /* Discount */
    discount:
      Number(item?.discount ?? 0) || 0,

    /* Tax */
    taxId:
      item?.taxId ||
      item?.tax?.id ||
      null,

    taxRate:
      Number(
        item?.taxRate ??
          item?.tax?.rate ??
          0,
      ) || 0,

    /* Existing quotation item ID */
    quotationItemId:
      item?.id ||
      null,
  };
}

/* -------------------------------------------------------------------------- */
/* SMALL UI PIECES                                                            */
/* -------------------------------------------------------------------------- */

function SectionHeading({
  title,
  subtitle,
}) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold text-ink">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-0.5 text-xs text-muted">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  children,
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">
        {label}
      </span>

      {children}
    </div>
  );
}

function BackButton({
  onClick,
  disabled,
  label = "Back",
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
    >
      <ArrowLeft className="h-4 w-4" />

      <span className="hidden sm:inline">
        {label}
      </span>
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

  /* ------------------------------------------------------------------------ */
  /* MASTER DATA                                                              */
  /* ------------------------------------------------------------------------ */

  const { data: parties = [] } = useParties();
  const { data: quotations = [] } = useQuotations();

  /* ------------------------------------------------------------------------ */
  /* EXISTING QUOTATION                                                       */
  /* ------------------------------------------------------------------------ */
  
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

  /* ------------------------------------------------------------------------ */
  /* MUTATIONS                                                                */
  /* ------------------------------------------------------------------------ */

  const createMut = useCreateQuotation();
  const updateMut = useUpdateQuotation();

  /* ------------------------------------------------------------------------ */
  /* FORM STATE                                                               */
  /* ------------------------------------------------------------------------ */

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(today);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const [loaded, setLoaded] =
    useState(!isEdit);

  const [draftRestored, setDraftRestored] =
    useState(false);

  const [draftSaved, setDraftSaved] =
    useState(false);

  const [draftLoaded, setDraftLoaded] =
    useState(false);

  /* ------------------------------------------------------------------------ */
  /* RESTORE DRAFT — NEW QUOTATIONS ONLY                                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (isEdit) return;

    const draft = loadQuotationDraft();

    if (draft) {
      setPartyId(draft.partyId || "");
      setDate(draft.date || today);
      setDiscount(draft.discount ?? 0);
      setNotes(draft.notes || "");
      setItems(
        Array.isArray(draft.items)
          ? draft.items
          : [],
      );

      setDraftRestored(true);
      setDraftLoaded(true);

      const timer = setTimeout(
        () => setDraftRestored(false),
        2500,
      );

      return () => clearTimeout(timer);
    }

    setDraftLoaded(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  /* ------------------------------------------------------------------------ */
  /* AUTO SAVE DRAFT — NEW QUOTATIONS ONLY                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (isEdit || !draftLoaded) return;

    const saved = saveQuotationDraft({
      partyId,
      date,
      discount,
      notes,
      items,
      updatedAt: new Date().toISOString(),
    });

    if (!saved) return;

    setDraftSaved(true);

    const timer = setTimeout(
      () => setDraftSaved(false),
      1200,
    );

    return () => clearTimeout(timer);
  }, [
    isEdit,
    draftLoaded,
    partyId,
    date,
    discount,
    notes,
    items,
  ]);

  /* ------------------------------------------------------------------------ */
  /* LOAD EXISTING QUOTATION                                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!isEdit || !quotation) return;

    console.log(quotation);

    setPartyId(
      String(
        quotation.partyId ||
          quotation.customerId ||
          quotation.party?.id ||
          "",
      ),
    );

    setDate(
      normalizeDate(
        quotation.date ||
          quotation.quotationDate ||
          quotation.createdAt,
      ),
    );

    setDiscount(
      quotation.discount ?? 0,
    );

    setNotes(
      quotation.notes || "",
    );

    setLoaded(true);
  }, [isEdit, quotation]);

  /* ------------------------------------------------------------------------ */
  /* LOAD EXISTING ITEMS                                                      */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!isEdit) return;

    if (!Array.isArray(savedItems)) return;

    /*
     * mapSavedItem() converts:
     *
     * productNameSnapshot → productName
     * skuSnapshot         → sku
     * attributesSnapshot  → attributeValues
     * attributesSnapshot  → selectedSpecification
     */
    setItems(
      savedItems.map(mapSavedItem),
    );
  }, [isEdit, savedItems]);

  /* ------------------------------------------------------------------------ */
  /* CUSTOMERS                                                                */
  /* ------------------------------------------------------------------------ */

  const customers = useMemo(
    () =>
      parties.filter(
        (party) =>
          party.type === "customer" ||
          party.type === "both",
      ),
    [parties],
  );

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (party) =>
          String(party.id) ===
          String(partyId),
      ) || null,
    [customers, partyId],
  );

  const customerMobile =
    selectedCustomer?.mobile ||
    selectedCustomer?.phone ||
    selectedCustomer?.mobileNumber ||
    selectedCustomer?.phoneNumber ||
    "";

  /* ------------------------------------------------------------------------ */
  /* NEXT QUOTATION NUMBER                                                    */
  /* ------------------------------------------------------------------------ */

  const nextNumber = useMemo(
    () =>
      getNextDocumentNumber(
        quotations,
        "QT-",
      ),
    [quotations],
  );

  /* ------------------------------------------------------------------------ */
  /* SUMMARY                                                                  */
  /* ------------------------------------------------------------------------ */

  const summary = useMemo(() => {
    let grossSubtotal = 0;
    let lineDiscountTotal = 0;
    let taxTotal = 0;

    items.forEach((item) => {
      grossSubtotal +=
        getQuantity(item) *
        getUnitPrice(item);

      lineDiscountTotal +=
        getLineDiscount(item);

      taxTotal += getLineTax(item);
    });

    const afterLineDiscount =
      Math.max(
        0,
        grossSubtotal -
          lineDiscountTotal,
      );

    const headerDiscount =
      Math.min(
        Math.max(
          Number(discount) || 0,
          0,
        ),
        afterLineDiscount,
      );

    const taxableSubtotal =
      Math.max(
        0,
        afterLineDiscount -
          headerDiscount,
      );

    return {
      itemCount: items.length,
      grossSubtotal,
      lineDiscountTotal,
      headerDiscount,
      taxableSubtotal,
      taxTotal,
      grandTotal:
        taxableSubtotal + taxTotal,
    };
  }, [items, discount]);

  /* ------------------------------------------------------------------------ */
  /* LOADING / ERROR                                                          */
  /* ------------------------------------------------------------------------ */

  if (
    isEdit &&
    (quotationError || itemsError)
  ) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title={
            <span className="text-base font-bold">
              Edit Quotation
            </span>
          }
          actions={
            <BackButton
              onClick={() =>
                navigate(
                  "/bills/quotations",
                )
              }
            />
          }
        />

        <ModuleTabs
          tabs={MODULE_TABS.bills}
        />

        <div className="p-6">
          <div className="rounded-xl border border-line bg-surface p-4 text-sm font-semibold text-red-500">
            Could not load this quotation.
          </div>
        </div>
      </div>
    );
  }

  if (
    isEdit &&
    (
      quotationLoading ||
      itemsLoading ||
      !loaded
    )
  ) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title={
            <span className="text-base font-bold">
              Edit Quotation
            </span>
          }
          actions={
            <BackButton
              onClick={() =>
                navigate(
                  "/bills/quotations",
                )
              }
            />
          }
        />

        <ModuleTabs
          tabs={MODULE_TABS.bills}
        />

        <div className="flex min-h-[300px] items-center justify-center p-6">
          <div className="text-sm font-semibold text-muted">
            Loading quotation…
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* SAVE / UPDATE                                                            */
  /* ------------------------------------------------------------------------ */

  const handleSave = async () => {
    if (!partyId) {
      toast.error("Select a customer");
      return;
    }

    if (!items.length) {
      toast.error("Add at least one item");
      return;
    }

    const normalizedItems =
      items.map((item) => ({
        ...item,
        productId:
          item?.productId ||
          item?.product?.id ||
          null,
      }));

    const invalidItemIndex =
      normalizedItems.findIndex(
        (item) =>
          !item.productId &&
          !item.variantId,
      );

    if (invalidItemIndex !== -1) {
      toast.error(
        `Item ${
          invalidItemIndex + 1
        } is missing its Product Master reference. Please remove it and add the item again.`,
      );

      return;
    }

    setSaving(true);

    try {
      const enrichedItems =
        await Promise.all(
          normalizedItems.map(
            async (item) => {
              const base = {
                quantity:
                  Number(
                    item.quantity,
                  ) || 0,

                unitPrice:
                  Number(
                    item.unitPrice,
                  ) || 0,

                discount:
                  Number(
                    item.discount,
                  ) || 0,

                taxId:
                  item.taxId || null,
              };

              /*
               * Existing row with a variant:
               * preserve the existing variant.
               */
              if (
                item.variantId &&
                (
                  !item.productId ||
                  item.quotationItemId
                )
              ) {
                return {
                  variantId:
                    item.variantId,
                  ...base,
                };
              }

              const variant =
                await variantResolver.resolveOrCreate(
                  {
                    productId:
                      item.productId,

                    defaultSku:
                      item.productSku ||
                      item.sku,

                    attributeValues:
                      item.attributeValues ||
                      {},
                  },
                );

              return {
                variantId:
                  variant.id,
                ...base,
              };
            },
          ),
        );

      const payload = {
        partyId,
        date,
        discount:
          Number(discount) || 0,
        notes,
        items: enrichedItems,
      };

      /* ------------------------------------------------------------------ */
      /* UPDATE                                                              */
      /* ------------------------------------------------------------------ */

      if (isEdit) {
        const updated =
          await updateMut.mutateAsync({
            id: quotationId,
            patch: payload,
          });

        toast.success(
          `Quotation ${
            updated?.number ||
            quotation?.number ||
            ""
          } updated`,
        );

        navigate(
          `/bills/quotations/${quotationId}`,
        );

        return;
      }

      /* ------------------------------------------------------------------ */
      /* CREATE                                                              */
      /* ------------------------------------------------------------------ */

      const created =
        await createMut.mutateAsync(
          payload,
        );

      clearQuotationDraft();

      toast.success(
        `Quotation ${created.number} created`,
      );

      navigate(
        `/bills/quotations/${created.id}`,
      );
    } catch (error) {
      console.error(
        "Quotation save failed:",
        error,
      );

      toast.error(
        error?.message ||
          "Save failed",
      );
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
            {isEdit
              ? "Edit Quotation"
              : "New Quotation"}
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

            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
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

      <ModuleTabs
        tabs={MODULE_TABS.bills}
      />

      <div className="mx-auto max-w-[1500px] p-4 pb-28 md:p-6">

        {/* Draft status */}
        {!isEdit &&
          (draftRestored ||
            draftSaved) && (
            <div className="mb-4 flex justify-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted shadow-sm">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    draftRestored
                      ? "bg-emerald-500"
                      : "bg-primary"
                  }`}
                />

                {draftRestored
                  ? "Previous draft restored"
                  : "Draft saved automatically"}
              </div>
            </div>
          )}

        <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-sm lg:flex-row">

          {/* ================================================================ */}
          {/* LEFT — FORM                                                       */}
          {/* ================================================================ */}

          <div className="min-w-0 flex-1 divide-y divide-line">

            {/* DETAILS */}
            <section className="p-4 md:p-5">
              <SectionHeading
                title="Quotation Details"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

                <Field label="Quotation No.">
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />

                    <Input
                      value={
                        isEdit
                          ? quotation?.number ||
                            ""
                          : nextNumber
                      }
                      readOnly
                      disabled
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field
                  label="Date"
                  required
                >
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />

                    <Input
                      type="date"
                      value={date}
                      onChange={(event) =>
                        setDate(
                          event.target.value,
                        )
                      }
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field
                  label="Customer Name"
                  required
                >
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />

                    <SearchableSelect
                      value={partyId}
                      onChange={setPartyId}
                      options={customers.map(
                        (customer) => ({
                          value: String(
                            customer.id,
                          ),
                          label:
                            customer.name,
                        }),
                      )}
                      placeholder="Select customer…"
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
                      value={
                        customerMobile
                      }
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
              <SectionHeading
                title="Items"
              />

              <LineItemsEditor
                items={items}
                onChange={setItems}
              />
            </section>

            {/* DISCOUNT + NOTES */}
            <section className="p-4 md:p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                <Field label="Header discount">
                  <MoneyInput
                    value={discount}
                    onChange={(event) =>
                      setDiscount(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="Notes">
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value,
                      )
                    }
                    placeholder="Optional"
                  />
                </Field>

              </div>
            </section>

          </div>

          {/* ================================================================ */}
          {/* RIGHT — SUMMARY                                                   */}
          {/* ================================================================ */}

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
                    {money(
                      summary.grossSubtotal,
                    )}
                  </span>
                </SummaryRow>

                {summary.lineDiscountTotal >
                  0 && (
                  <SummaryRow label="Item Discount">
                    <span className="text-sm font-medium text-red-600">
                      -{" "}
                      {money(
                        summary.lineDiscountTotal,
                      )}
                    </span>
                  </SummaryRow>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted">
                      Discount
                    </span>

                    {summary.headerDiscount >
                      0 && (
                      <Percent className="h-3 w-3 text-muted" />
                    )}
                  </div>

                  <span
                    className={
                      summary.headerDiscount >
                      0
                        ? "text-sm font-medium text-red-600"
                        : "text-sm text-muted"
                    }
                  >
                    {summary.headerDiscount >
                    0
                      ? `- ${money(
                          summary.headerDiscount,
                        )}`
                      : money(0)}
                  </span>
                </div>

                <SummaryRow label="GST / Tax">
                  <span className="text-sm font-medium text-ink">
                    {money(
                      summary.taxTotal,
                    )}
                  </span>
                </SummaryRow>

                <div className="border-t border-dashed border-line pt-3">
                  <div className="flex items-end justify-between gap-3">

                    <div>
                      <p className="text-xs text-muted">
                        Grand Total
                      </p>

                      <p className="mt-0.5 text-xs text-muted">
                        Including tax
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-lg font-bold text-ink">
                      <IndianRupee className="h-4 w-4" />

                      <span>
                        {Number(
                          summary.grandTotal,
                        ).toLocaleString(
                          "en-IN",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
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