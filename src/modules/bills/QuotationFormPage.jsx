import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Card,
  CardHeader,
  CardBody,
} from "@/components/ui/Card";
import { LineItemsEditor } from "@/components/forms/LineItemsEditor";

import { toast } from "@/lib/toast";
import { useCreateQuotation } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { variantResolver } from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

/* -------------------------------------------------------------------------- */
/* DRAFT STORAGE                                                              */
/* -------------------------------------------------------------------------- */

const QUOTATION_DRAFT_KEY =
  "timber-erp-quotation-draft-v1";

function loadQuotationDraft() {
  try {
    const raw = localStorage.getItem(
      QUOTATION_DRAFT_KEY,
    );

    if (!raw) {
      return null;
    }

    const draft = JSON.parse(raw);

    if (!draft || typeof draft !== "object") {
      return null;
    }

    return draft;
  } catch (error) {
    console.error(
      "Failed to load quotation draft:",
      error,
    );

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
    console.error(
      "Failed to save quotation draft:",
      error,
    );

    return false;
  }
}

function clearQuotationDraft() {
  try {
    localStorage.removeItem(
      QUOTATION_DRAFT_KEY,
    );
  } catch (error) {
    console.error(
      "Failed to clear quotation draft:",
      error,
    );
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

/*
 * Different item implementations may use different
 * property names.
 *
 * Keep the summary tolerant so the existing
 * LineItemsEditor does not need to be changed.
 */

function getQuantity(item) {
  return (
    Number(
      item?.quantity ??
        item?.qty ??
        0,
    ) || 0
  );
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
  return (
    Number(
      item?.discount ??
        item?.discountAmount ??
        0,
    ) || 0
  );
}

function getLineTax(item) {
  /*
   * Prefer already calculated tax amount.
   */
  if (
    item?.taxAmount !== undefined &&
    item?.taxAmount !== null &&
    item?.taxAmount !== ""
  ) {
    return Number(item.taxAmount) || 0;
  }

  /*
   * Otherwise calculate using tax percentage.
   */
  const taxRate =
    Number(
      item?.taxRate ??
        item?.gstRate ??
        item?.taxPercentage ??
        item?.gstPercentage ??
        0,
    ) || 0;

  if (!taxRate) {
    return 0;
  }

  const quantity = getQuantity(item);
  const unitPrice = getUnitPrice(item);
  const lineDiscount = getLineDiscount(item);

  const taxableValue = Math.max(
    0,
    quantity * unitPrice - lineDiscount,
  );

  return taxableValue * (taxRate / 100);
}

function getItemName(item) {
  return (
    item?.productName ||
    item?.name ||
    item?.product?.name ||
    item?.variantName ||
    item?.productSku ||
    item?.sku ||
    "Item"
  );
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export function QuotationFormPage() {
  const navigate = useNavigate();

  const { data: parties = [] } =
    useParties();

  const createMut =
    useCreateQuotation();

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  /* ------------------------------------------------------------------------ */
  /* STATE                                                                    */
  /* ------------------------------------------------------------------------ */

  const [partyId, setPartyId] =
    useState("");

  const [date, setDate] =
    useState(today);

  const [discount, setDiscount] =
    useState(0);

  const [notes, setNotes] =
    useState("");

  const [items, setItems] =
    useState([]);

  const [saving, setSaving] =
    useState(false);

  const [draftRestored, setDraftRestored] =
    useState(false);

  const [draftSaved, setDraftSaved] =
    useState(false);

  /*
   * Prevent the initial empty state from
   * immediately overwriting an existing draft.
   */
  const [draftLoaded, setDraftLoaded] =
    useState(false);

  /* ------------------------------------------------------------------------ */
  /* RESTORE DRAFT                                                            */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const draft = loadQuotationDraft();

    if (draft) {
      setPartyId(
        draft.partyId || "",
      );

      setDate(
        draft.date || today,
      );

      setDiscount(
        draft.discount ?? 0,
      );

      setNotes(
        draft.notes || "",
      );

      setItems(
        Array.isArray(draft.items)
          ? draft.items
          : [],
      );

      setDraftRestored(true);

      /*
       * Hide restored message after a short time.
       */
      const timer = setTimeout(() => {
        setDraftRestored(false);
      }, 2500);

      setDraftLoaded(true);

      return () => {
        clearTimeout(timer);
      };
    }

    setDraftLoaded(true);
  }, []);

  /* ------------------------------------------------------------------------ */
  /* AUTO SAVE DRAFT                                                          */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    /*
     * Do not save the initial empty state before
     * the existing draft has been restored.
     */
    if (!draftLoaded) {
      return;
    }

    const draft = {
      partyId,
      date,
      discount,
      notes,
      items,
      updatedAt:
        new Date().toISOString(),
    };

    const saved =
      saveQuotationDraft(draft);

    if (!saved) {
      return;
    }

    setDraftSaved(true);

    const timer = setTimeout(() => {
      setDraftSaved(false);
    }, 1200);

    return () => {
      clearTimeout(timer);
    };
  }, [
    draftLoaded,
    partyId,
    date,
    discount,
    notes,
    items,
  ]);

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

  /* ------------------------------------------------------------------------ */
  /* SELECTED CUSTOMER                                                        */
  /* ------------------------------------------------------------------------ */

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (party) =>
          party.id === partyId,
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
  /* QUOTATION NUMBER                                                         */
  /* ------------------------------------------------------------------------ */

  /*
   * Existing repository/backend will generate
   * the actual quotation number when saved.
   *
   * Do not create a fake number here.
   */
  const quotationNumber =
    "Will be generated automatically";

  /* ------------------------------------------------------------------------ */
  /* SUMMARY                                                                  */
  /* ------------------------------------------------------------------------ */

  const summary = useMemo(() => {
    let grossSubtotal = 0;
    let lineDiscountTotal = 0;
    let taxTotal = 0;

    items.forEach((item) => {
      const quantity =
        getQuantity(item);

      const unitPrice =
        getUnitPrice(item);

      const lineDiscount =
        getLineDiscount(item);

      const lineTax =
        getLineTax(item);

      const lineSubtotal =
        quantity * unitPrice;

      grossSubtotal +=
        lineSubtotal;

      lineDiscountTotal +=
        lineDiscount;

      taxTotal +=
        lineTax;
    });

    /*
     * Value after item-level discounts.
     */
    const afterLineDiscount =
      Math.max(
        0,
        grossSubtotal -
          lineDiscountTotal,
      );

    /*
     * Header discount comes after
     * line discounts.
     */
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

    const grandTotal =
      taxableSubtotal +
      taxTotal;

    return {
      itemCount: items.length,
      grossSubtotal,
      lineDiscountTotal,
      headerDiscount,
      taxableSubtotal,
      taxTotal,
      grandTotal,
    };
  }, [items, discount]);

  /* ------------------------------------------------------------------------ */
  /* SAVE QUOTATION                                                           */
  /* ------------------------------------------------------------------------ */

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
        (item) => !item.productId,
      );

    if (invalidItemIndex !== -1) {
      toast.error(
        `Item ${invalidItemIndex + 1} is missing its Product Master reference. Please remove it and add the item again.`,
      );
      return;
    }

    setSaving(true);

    try {
      const enrichedItems =
        await Promise.all(
          normalizedItems.map(
            async (item) => {
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
            },
          ),
        );

      const payload = {
        partyId,
        date,

        discount:
          Number(discount) || 0,

        notes,

        items:
          enrichedItems,
      };

      const created =
        await createMut.mutateAsync(
          payload,
        );

      /*
       * IMPORTANT:
       *
       * Only clear the draft AFTER the
       * quotation has actually been created.
       */
      clearQuotationDraft();

      toast.success(
        `Quotation ${created.number} created`,
      );

      navigate(
        `/bills/quotations/${created.id}`,
      );
    } catch (error) {
      console.error(error);

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

      {/* ================================================================== */}
      {/* HEADER                                                             */}
      {/* ================================================================== */}

      <PageHeader
        title="New Quotation"
        description="Create a quotation for your customer"
        actions={
          <div className="flex items-center gap-2">

            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  "/bills/quotations",
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />

              <span className="hidden sm:inline">
                Cancel
              </span>
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-4 w-4" />

              {saving
                ? "Saving…"
                : "Save Quotation"}
            </Button>

          </div>
        }
      />

      <ModuleTabs
        tabs={MODULE_TABS.bills}
      />

      {/* ================================================================== */}
      {/* MAIN                                                                */}
      {/* ================================================================== */}

      <div className="p-4 md:p-6 pb-28 max-w-[1500px] mx-auto">

        {/* Draft status */}
        {(draftRestored ||
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

        {/* ================================================================== */}
        {/* CUSTOMER / DETAILS — FULL WIDTH                                   */}
        {/* ================================================================== */}

        <div className="space-y-4">

          <Card>
            <CardHeader
              title="Quotation Details"
              subtitle="Enter the customer and quotation information."
            />

            <CardBody>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                {/* Quotation Number */}
                <Field label="Quotation No.">
                  <div className="relative">

                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />

                    <Input
                      value={
                        quotationNumber
                      }
                      readOnly
                      disabled
                      className="pl-9"
                    />

                  </div>
                </Field>

                {/* Date */}
                <Field
                  label="Date"
                  required
                >
                  <div className="relative">

                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />

                    <Input
                      type="date"
                      value={date}
                      onChange={(event) =>
                        setDate(
                          event.target
                            .value,
                        )
                      }
                      className="pl-9"
                    />

                  </div>
                </Field>

                {/* Customer */}
                <Field
                  label="Customer Name"
                  required
                >
                  <div className="relative">

                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none z-10" />

                    <Select
                      value={partyId}
                      onChange={(event) =>
                        setPartyId(
                          event.target
                            .value,
                        )
                      }
                      className="pl-9"
                    >
                      <option value="">
                        Select customer…
                      </option>

                      {customers.map(
                        (customer) => (
                          <option
                            key={
                              customer.id
                            }
                            value={
                              customer.id
                            }
                          >
                            {
                              customer.name
                            }
                          </option>
                        ),
                      )}
                    </Select>

                  </div>
                </Field>

                {/* Customer Mobile */}
                <Field label="Customer Mobile">
                  <div className="relative">

                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />

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

              {/* Selected customer information */}
              {selectedCustomer && (
                <div className="mt-4 rounded-xl border border-line bg-bg/40 px-3 py-2.5">

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">

                    <div className="flex items-center gap-2">

                      <span className="text-muted">
                        Customer
                      </span>

                      <span className="font-semibold text-ink">
                        {
                          selectedCustomer.name
                        }
                      </span>

                    </div>

                    {customerMobile && (
                      <div className="flex items-center gap-2">

                        <span className="text-muted">
                          Mobile
                        </span>

                        <span className="font-semibold text-ink">
                          {
                            customerMobile
                          }
                        </span>

                      </div>
                    )}

                  </div>

                </div>
              )}

            </CardBody>
          </Card>

          {/* ================================================================= */}
          {/* ITEMS + SUMMARY                                                   */}
          {/* ================================================================= */}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">

            {/* =============================================================== */}
            {/* LEFT — ITEMS                                                     */}
            {/* =============================================================== */}

            <div className="min-w-0 space-y-4">

              <Card>
                <CardHeader
                  title="Items"
                  subtitle="Add the products and quantities included in this quotation."
                />

                <CardBody>
                  <LineItemsEditor
                    items={items}
                    onChange={setItems}
                  />
                </CardBody>
              </Card>

              {/* ============================================================= */}
              {/* DISCOUNT + NOTES                                               */}
              {/* ============================================================= */}

              <Card>
                <CardBody>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <Field label="Header discount">
                      <MoneyInput
                        value={discount}
                        onChange={(event) =>
                          setDiscount(
                            event.target
                              .value,
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
                            event.target
                              .value,
                          )
                        }
                        placeholder="Optional"
                      />
                    </Field>

                  </div>

                </CardBody>
              </Card>

            </div>

            {/* =============================================================== */}
            {/* RIGHT — SUMMARY                                                  */}
            {/* =============================================================== */}

            <aside className="lg:sticky lg:top-4 self-start">

              <div className="rounded-2xl border border-line bg-surface shadow-sm overflow-hidden">

                {/* Summary Header */}
                <div className="px-4 py-4 border-b border-line">

                  <div className="flex items-center gap-2">

                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">

                      <Receipt className="h-4 w-4 text-primary" />

                    </div>

                    <div>

                      <h3 className="text-sm font-semibold text-ink">
                        Quotation Summary
                      </h3>

                      <p className="text-xs text-muted">
                        Live calculation
                      </p>

                    </div>

                  </div>

                </div>

                {/* Item Count */}
                <div className="px-4 py-3 border-b border-line">

                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-2 text-sm text-muted">

                      <Package className="h-4 w-4" />

                      Items

                    </div>

                    <span className="font-semibold text-ink">
                      {
                        summary.itemCount
                      }
                    </span>

                  </div>

                </div>

                {/* Amounts */}
                <div className="px-4 py-4 space-y-3">

                  {/* Subtotal */}
                  <div className="flex items-center justify-between gap-3">

                    <span className="text-sm text-muted">
                      Subtotal
                    </span>

                    <span className="text-sm font-medium text-ink">
                      {
                        money(
                          summary.grossSubtotal,
                        )
                      }
                    </span>

                  </div>

                  {/* Item Discount */}
                  {summary.lineDiscountTotal >
                    0 && (
                    <div className="flex items-center justify-between gap-3">

                      <span className="text-sm text-muted">
                        Item Discount
                      </span>

                      <span className="text-sm font-medium text-red-600">
                        -{" "}
                        {
                          money(
                            summary.lineDiscountTotal,
                          )
                        }
                      </span>

                    </div>
                  )}

                  {/* Header Discount */}
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

                  {/* GST */}
                  <div className="flex items-center justify-between gap-3">

                    <span className="text-sm text-muted">
                      GST / Tax
                    </span>

                    <span className="text-sm font-medium text-ink">
                      {
                        money(
                          summary.taxTotal,
                        )
                      }
                    </span>

                  </div>

                  {/* Grand Total */}
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

                {/* Summary Footer */}
                <div className="px-4 py-3 bg-bg/50 border-t border-line">

                  <p className="text-[11px] leading-4 text-muted">
                    Amount updates automatically
                    when items, quantity, price
                    or discount changes.
                  </p>

                </div>

              </div>

            </aside>

          </div>

        </div>

      </div>

    </div>
  );
}

export default QuotationFormPage;