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

import { variantResolver } from "@/lib/api/repos";
import { getNextDocumentNumber } from "@/lib/utils/docNumber";
import { MODULE_TABS } from "@/app/moduleNav";

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

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

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
    getQuantity(item) * getUnitPrice(item) -
      getLineDiscount(item),
  );

  return taxableValue * (taxRate / 100);
}

/* ==========================================================================
   ATTRIBUTE / SPECIFICATION HELPERS
========================================================================== */

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
 * Recover Specification from attributesSnapshot.
 *
 * Saved invoice items can contain:
 *
 * attributesSnapshot: [
 *   {
 *     key: "Thickness",
 *     value: "18mm"
 *   }
 * ]
 *
 * or:
 *
 * attributesSnapshot: [
 *   {
 *     name: "Specification",
 *     value: "18mm"
 *   }
 * ]
 *
 * We support both without changing the backend structure.
 */
function getSpecificationFromSnapshot(attributesSnapshot) {
  if (!Array.isArray(attributesSnapshot)) {
    return "";
  }

  /* First look for an explicitly named Specification */
  const specificationAttribute =
    attributesSnapshot.find((attr) => {
      if (!attr) return false;

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

  if (
    specificationAttribute?.value !== undefined &&
    specificationAttribute?.value !== null
  ) {
    return String(
      specificationAttribute.value,
    );
  }

  /*
   * Product specifications in the current master can be stored under
   * names such as Thickness, Size, Pack Size, etc.
   *
   * If there isn't an explicit "Specification" key,
   * use the first meaningful snapshot value.
   */
  const firstValue =
    attributesSnapshot.find(
      (attr) =>
        attr &&
        attr.value !== undefined &&
        attr.value !== null &&
        String(attr.value).trim() !== "",
    );

  return firstValue?.value != null
    ? String(firstValue.value)
    : "";
}

/* ==========================================================================
   EXISTING INVOICE ITEM → LINE ITEMS EDITOR ROW
========================================================================== */

/*
 * Saved invoice items can keep their original display information inside
 * snapshot fields:
 *
 * productNameSnapshot
 * skuSnapshot
 * attributesSnapshot
 *
 * LineItemsEditor expects:
 *
 * productName
 * sku
 * attributeValues
 * selectedSpecification
 *
 * This mapper converts the persisted record into the editor structure.
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

  const attributesSnapshot = Array.isArray(
    item?.attributesSnapshot,
  )
    ? item.attributesSnapshot
    : [];

  /*
   * Convert snapshot attributes into the editor's attributeValues object.
   */
  const snapshotAttributeValues =
    attributesToValues(attributesSnapshot);

  const attributeValues =
    item?.attributeValues &&
    typeof item.attributeValues === "object"
      ? item.attributeValues
      : variant?.attributeValues &&
          typeof variant.attributeValues === "object"
        ? variant.attributeValues
        : snapshotAttributeValues;

  /* ---------------------------------------------------------------------- */
  /* SPECIFICATIONS                                                          */
  /* ---------------------------------------------------------------------- */

  const specifications = Array.isArray(
    item?.specifications,
  )
    ? item.specifications
    : Array.isArray(
          variant?.specifications,
        )
      ? variant.specifications
      : [];

  /*
   * IMPORTANT FIX:
   *
   * Existing invoice records may not have selectedSpecification directly.
   * The specification can be inside attributesSnapshot.
   */
  const snapshotSpecification =
    getSpecificationFromSnapshot(
      attributesSnapshot,
    );

  const selectedSpecification =
    item?.selectedSpecification ||
    item?.specificationSnapshot ||
    item?.specification ||
    snapshotSpecification ||
    Object.values(
      attributeValues || {},
    )[0] ||
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
  /* FINAL LINE ITEM                                                         */
  /* ---------------------------------------------------------------------- */

  return {
    tempId:
      item?.tempId ||
      item?.id ||
      `existing-invoice-item-${index}`,

    productId,

    productSku:
      item?.productSku ||
      sku,

    productName,

    productType,

    /* Snapshot fields */
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

    /* Attributes / Specification */
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

    /* Existing invoice item ID */
    invoiceItemId:
      item?.id ||
      null,
  };
}

/* ==========================================================================
   SMALL UI PIECES
========================================================================== */

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

/* ==========================================================================
   INVOICE FORM
========================================================================== */

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const params = useParams();

  const invoiceId =
    getInvoiceIdFromParams(params);

  const isEdit = Boolean(invoiceId);

  /* ------------------------------------------------------------------------ */
  /* MASTER DATA                                                              */
  /* ------------------------------------------------------------------------ */

  const { data: parties = [] } =
    useParties();

  const { data: allInvoices = [] } =
    useInvoices();

  const nextInvoiceNumber = useMemo(
    () =>
      getNextDocumentNumber(
        allInvoices,
        "INV-",
      ),
    [allInvoices],
  );

  /* ------------------------------------------------------------------------ */
  /* INVOICE DATA                                                             */
  /* ------------------------------------------------------------------------ */

  const {
    data: invoice,
    isLoading: invoiceLoading,
    isError: invoiceError,
  } = useInvoice(invoiceId);

  /*
   * Do not use = [] here.
   *
   * A new empty array on every render can cause the edit-mode effect to
   * trigger repeatedly while the query is loading.
   */
  const {
    data: invoiceItemsData,
    isLoading: itemsLoading,
    isError: itemsError,
  } = useInvoiceItems(invoiceId);

  /* ------------------------------------------------------------------------ */
  /* MUTATIONS                                                                */
  /* ------------------------------------------------------------------------ */

  const createMut =
    useCreateInvoice();

  const updateMut =
    useUpdateInvoice();

  /* ------------------------------------------------------------------------ */
  /* FORM STATE                                                               */
  /* ------------------------------------------------------------------------ */

  const [partyId, setPartyId] =
    useState("");

  const [date, setDate] =
    useState(todayLocal());

  const [dueDate, setDueDate] =
    useState("");

  const [status, setStatus] =
    useState("issued");

  const [discount, setDiscount] =
    useState(0);

  const [notes, setNotes] =
    useState("");

  const [items, setItems] =
    useState([]);

  const [saving, setSaving] =
    useState(false);

  const [loaded, setLoaded] =
    useState(!isEdit);

  /* ------------------------------------------------------------------------ */
  /* CUSTOMERS                                                                */
  /* ------------------------------------------------------------------------ */

  const customers = parties.filter(
    (party) =>
      party.type === "customer" ||
      party.type === "both",
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

  /* ==========================================================================
     LOAD EXISTING INVOICE
  ========================================================================== */

  useEffect(() => {
    if (!isEdit) return;
    if (!invoice) return;

    setPartyId(
      String(
        invoice.partyId ||
          invoice.customerId ||
          invoice.party?.id ||
          "",
      ),
    );

    setDate(
      normalizeDate(
        invoice.date ||
          invoice.invoiceDate ||
          invoice.createdAt,
      ),
    );

    setDueDate(
      normalizeDate(
        invoice.dueDate,
      ),
    );

    setStatus(
      invoice.status ||
        "issued",
    );

    setDiscount(
      invoice.discount ?? 0,
    );

    setNotes(
      invoice.notes || "",
    );

    setLoaded(true);
  }, [isEdit, invoice]);

  /* ==========================================================================
     LOAD EXISTING INVOICE ITEMS
  ========================================================================== */

  useEffect(() => {
    if (!isEdit) return;

    if (
      !Array.isArray(
        invoiceItemsData,
      )
    ) {
      return;
    }

    /*
     * IMPORTANT:
     *
     * mapSavedItem() now restores:
     *
     * productNameSnapshot → productName
     * skuSnapshot         → sku
     * attributesSnapshot  → attributeValues
     * attributesSnapshot  → selectedSpecification
     */
    setItems(
      invoiceItemsData.map(
        mapSavedItem,
      ),
    );
  }, [
    isEdit,
    invoiceItemsData,
  ]);

  /* ==========================================================================
     LOADING / ERROR
  ========================================================================== */

  if (
    isEdit &&
    (invoiceError ||
      itemsError)
  ) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title={
            <span className="text-base font-bold">
              Edit Invoice
            </span>
          }
          description="Unable to load this invoice"
          actions={
            <BackButton
              onClick={() =>
                navigate(
                  "/bills/invoices",
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
            Could not load this invoice.
          </div>
        </div>
      </div>
    );
  }

  if (
    isEdit &&
    (
      invoiceLoading ||
      itemsLoading ||
      !loaded
    )
  ) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title={
            <span className="text-base font-bold">
              Edit Invoice
            </span>
          }
          description="Loading invoice details..."
          actions={
            <BackButton
              onClick={() =>
                navigate(
                  "/bills/invoices",
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
    if (!partyId) {
      toast.error(
        "Select a customer",
      );
      return;
    }

    if (!items.length) {
      toast.error(
        "Add at least one item",
      );
      return;
    }

    const invalidItemIndex =
      items.findIndex(
        (item) =>
          !(
            item.productId ||
            item.product?.id
          ) &&
          !item.variantId,
      );

    if (
      invalidItemIndex !== -1
    ) {
      toast.error(
        `Item ${
          invalidItemIndex + 1
        } is missing its Product Master reference. Please remove it and add the item again.`,
      );

      return;
    }

    setSaving(true);

    try {
      /*
       * Resolve variants exactly like the existing New Invoice flow.
       * Existing variant IDs are preserved when possible.
       */
      const enrichedItems =
        await Promise.all(
          items.map(
            async (item) => {
              const productId =
                item.productId ||
                item.product?.id ||
                null;

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
                  item.taxId ||
                  null,
              };

              /*
               * Existing row without enough info:
               * keep its variant.
               */
              if (
                item.variantId &&
                (
                  !productId ||
                  item.invoiceItemId
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
                    productId,

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
        dueDate:
          dueDate || null,
        status,
        discount:
          Number(discount) || 0,
        notes,
        items:
          enrichedItems,
      };

      /* -------------------------------------------------------------------- */
      /* CREATE                                                                */
      /* -------------------------------------------------------------------- */

      if (!isEdit) {
        const created =
          await createMut.mutateAsync(
            payload,
          );

        toast.success(
          `Invoice ${created.number} created`,
        );

        navigate(
          `/bills/invoices/${created.id}`,
        );

        return;
      }

      /* -------------------------------------------------------------------- */
      /* UPDATE                                                                */
      /* -------------------------------------------------------------------- */

      const updated =
        await updateMut.mutateAsync({
          id: invoiceId,
          patch: payload,
        });

      toast.success(
        `Invoice ${
          updated?.number ||
          invoice?.number ||
          ""
        } updated`,
      );

      navigate(
        `/bills/invoices/${invoiceId}`,
      );
    } catch (error) {
      console.error(
        "Invoice save failed:",
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

  /* ==========================================================================
     UI
  ========================================================================== */

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title={
          <span className="text-lg font-bold">
            {isEdit
              ? "Edit Invoice"
              : "New Invoice"}
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
                    ? `/bills/invoices/${invoiceId}`
                    : "/bills/invoices",
                )
              }
            />

            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                saving ||
                !partyId ||
                !items.length
              }
            >
              <Save className="h-4 w-4" />

              {saving
                ? "Saving…"
                : isEdit
                  ? "Update Invoice"
                  : "Save Invoice"}
            </Button>

          </div>
        }
      />

      <ModuleTabs
        tabs={MODULE_TABS.bills}
      />

      <div className="mx-auto max-w-[1500px] p-4 pb-28 md:p-6">

        <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-sm lg:flex-row">

          {/* ==================================================================
              LEFT — FORM
          ================================================================== */}

          <div className="min-w-0 flex-1 divide-y divide-line">

            {/* DETAILS */}
            <section className="p-4 md:p-5">
              <SectionHeading
                title="Invoice Details"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

                <Field label="Invoice No.">
                  <Input
                    value={
                      isEdit
                        ? invoice?.number ||
                          ""
                        : nextInvoiceNumber
                    }
                    readOnly
                    disabled
                  />
                </Field>

                <Field
                  label="Customer"
                  required
                >
                  <SearchableSelect
                    value={partyId}
                    onChange={setPartyId}
                    options={customers.map(
                      (party) => ({
                        value: String(
                          party.id,
                        ),
                        label:
                          party.name,
                      }),
                    )}
                    placeholder="Select customer…"
                    searchPlaceholder="Search customer…"
                    emptyText="No customers found"
                  />
                </Field>

                <Field label="Status">
                  <SearchableSelect
                    value={status}
                    onChange={setStatus}
                    options={[
                      {
                        value: "draft",
                        label: "Draft",
                      },
                      {
                        value: "issued",
                        label: "Issued",
                      },

                      ...(
                        [
                          "partially_paid",
                          "paid",
                          "overdue",
                          "cancelled",
                        ].includes(status)
                          ? [
                              {
                                value: status,
                                label:
                                  status
                                    .replace(
                                      /_/g,
                                      " ",
                                    )
                                    .replace(
                                      /\b\w/g,
                                      (c) =>
                                        c.toUpperCase(),
                                    ),
                              },
                            ]
                          : []
                      ),
                    ]}
                    placeholder="Select status…"
                  />
                </Field>

                <Field label="Date">
                  <Input
                    type="date"
                    value={date}
                    onChange={(event) =>
                      setDate(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="Due Date">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(event) =>
                      setDueDate(
                        event.target.value,
                      )
                    }
                  />
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

          {/* ==================================================================
              RIGHT — SUMMARY
          ================================================================== */}

          <aside className="rounded-b-2xl border-t border-line bg-bg/40 lg:w-1/5 lg:min-w-[260px] lg:rounded-b-none lg:rounded-r-2xl lg:border-l lg:border-t-0">

            <div className="lg:sticky lg:top-4">

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

export default InvoiceFormPage;