import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { FormGrid } from "@/components/ui/FormGrid";
import { LineItemsEditor } from "@/components/forms/LineItemsEditor";

import { toast } from "@/lib/toast";

import {
  useCreateInvoice,
  useInvoice,
  useInvoiceItems,
  useUpdateInvoice,
} from "@/hooks/useDocuments";

import { useParties } from "@/hooks/useParties";

import { variantResolver } from "@/lib/api/repos";
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
  if (!value) {
    return "";
  }

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
  return (
    params.id ||
    params.invoiceId ||
    null
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

  const isEdit =
    Boolean(invoiceId);

  /* ------------------------------------------------------------------------
     MASTER DATA
  ------------------------------------------------------------------------ */

  const {
    data: parties = [],
  } = useParties();

  /* ------------------------------------------------------------------------
     INVOICE DATA
  ------------------------------------------------------------------------ */

  const {
    data: invoice,
    isLoading: invoiceLoading,
    isError: invoiceError,
  } = useInvoice(invoiceId);

  const {
    data: invoiceItems = [],
    isLoading: itemsLoading,
    isError: itemsError,
  } = useInvoiceItems(invoiceId);

  /* ------------------------------------------------------------------------
     MUTATIONS
  ------------------------------------------------------------------------ */

  const createMut =
    useCreateInvoice();

  const updateMut =
    useUpdateInvoice();

  /* ------------------------------------------------------------------------
     FORM STATE
  ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
     CUSTOMERS
  ------------------------------------------------------------------------ */

  const customers =
    parties.filter(
      (party) =>
        party.type === "customer" ||
        party.type === "both",
    );

  /* ==========================================================================
     LOAD EXISTING INVOICE
  ========================================================================== */

  useEffect(() => {
    if (!isEdit) {
      return;
    }

    if (!invoice) {
      return;
    }

    /*
     * Existing invoice header data.
     *
     * We support both the normal API field names and a few
     * common fallback names so old invoice records don't break.
     */

    setPartyId(
      invoice.partyId ||
        invoice.customerId ||
        invoice.party?.id ||
        "",
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
      invoice.discount ??
        0,
    );

    setNotes(
      invoice.notes ||
        "",
    );

    setLoaded(true);
  }, [
    isEdit,
    invoice,
  ]);

  /* ==========================================================================
     LOAD EXISTING INVOICE ITEMS
  ========================================================================== */

  useEffect(() => {
    if (!isEdit) {
      return;
    }

    if (!Array.isArray(invoiceItems)) {
      return;
    }

    /*
     * Convert existing invoice-item records into the exact structure
     * expected by LineItemsEditor.
     *
     * Existing Add Item / Product Picker flow is NOT changed.
     */

    const mappedItems =
      invoiceItems.map(
        (item, index) => {
          const variant =
            item.variant ||
            item.matchedVariant ||
            null;

          const product =
            item.product ||
            variant?.product ||
            null;

          const productId =
            item.productId ||
            product?.id ||
            variant?.productId ||
            null;

          const variantId =
            item.variantId ||
            variant?.id ||
            null;

          const productName =
            item.productName ||
            product?.name ||
            item.name ||
            variant?.productName ||
            "";

          const brandName =
            item.brandName ||
            product?.brandName ||
            product?.brand?.name ||
            item.brand?.name ||
            "";

          const productType =
            item.productType ||
            product?.productType ||
            product?.category?.name ||
            item.category?.name ||
            "";

          const sku =
            item.sku ||
            item.productSku ||
            variant?.sku ||
            product?.sku ||
            "";

          const attributeValues =
            item.attributeValues ||
            variant?.attributeValues ||
            {};

          const specifications =
            Array.isArray(
              item.specifications,
            )
              ? item.specifications
              : Array.isArray(
                  variant?.specifications,
                )
                ? variant.specifications
                : [];

          const selectedSpecification =
            item.selectedSpecification ||
            item.specification ||
            "";

          const unit =
            item.unit ||
            variant?.unit ||
            product?.unit ||
            "";

          const quantity =
            item.quantity ??
            item.qty ??
            1;

          const unitPrice =
            item.unitPrice ??
            item.rate ??
            item.price ??
            0;

          const taxRate =
            item.taxRate ??
            item.tax?.rate ??
            0;

          return {
            /*
             * Temporary frontend ID.
             *
             * This is important because LineItemsEditor uses tempId
             * for edit/delete operations.
             */
            tempId:
              item.tempId ||
              item.id ||
              `existing-invoice-item-${index}`,

            /*
             * Product information
             */
            productId,

            productSku:
              item.productSku ||
              sku,

            productName,

            productType,

            brandId:
              item.brandId ||
              product?.brandId ||
              product?.brand?.id ||
              null,

            brandName,

            /*
             * Variant information
             */
            variantId,

            variant,

            matchedVariant:
              item.matchedVariant ||
              variant ||
              null,

            sku,

            /*
             * Specifications
             */
            attributeValues,

            specifications,

            selectedSpecification,

            unit,

            /*
             * Billing values
             */
            quantity:
              Number(quantity) || 1,

            unitPrice:
              Number(unitPrice) || 0,

            rate:
              Number(unitPrice) || 0,

            defaultPrice:
              Number(unitPrice) || 0,

            discount:
              Number(
                item.discount ?? 0,
              ) || 0,

            taxId:
              item.taxId ||
              item.tax?.id ||
              null,

            taxRate:
              Number(taxRate) || 0,

            /*
             * Keep original item ID.
             *
             * Useful when the backend supports updating
             * existing invoice lines.
             */
            invoiceItemId:
              item.id ||
              null,
          };
        },
      );

    setItems(mappedItems);
  }, [
    isEdit,
    invoiceItems,
  ]);

  /* ==========================================================================
     LOADING / ERROR
  ========================================================================== */

  if (
    isEdit &&
    (invoiceLoading ||
      itemsLoading ||
      !loaded)
  ) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title="Edit Invoice"
          description="Loading invoice details..."
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  "/bills/invoices",
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">
                Back
              </span>
            </Button>
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

  if (
    isEdit &&
    (invoiceError ||
      itemsError ||
      !invoice)
  ) {
    return (
      <div className="page-container min-h-full">
        <PageHeader
          title="Edit Invoice"
          description="Unable to load this invoice"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  "/bills/invoices",
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">
                Back
              </span>
            </Button>
          }
        />

        <ModuleTabs
          tabs={MODULE_TABS.bills}
        />

        <div className="p-6">
          <Card>
            <CardBody>
              <div className="text-sm font-semibold text-red-500">
                Could not load this invoice.
              </div>
            </CardBody>
          </Card>
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

    setSaving(true);

    try {
      /*
       * Resolve variants exactly like the existing New Invoice flow.
       *
       * Existing variant IDs are preserved when possible.
       */

      const enrichedItems =
        await Promise.all(
          items.map(
            async (item) => {
              /*
               * If the existing row already has a variant ID and
               * does not have enough product information to resolve
               * a new variant, preserve the existing variant.
               */
              if (
                item.variantId &&
                !item.productId
              ) {
                return {
                  variantId:
                    item.variantId,

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
              }

              /*
               * Existing behavior for newly added / edited rows.
               */
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

        dueDate:
          dueDate || null,

        status,

        discount:
          Number(discount) || 0,

        notes,

        items:
          enrichedItems,
      };

      /* --------------------------------------------------------------------
         CREATE
      -------------------------------------------------------------------- */

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

      /* --------------------------------------------------------------------
         UPDATE
      -------------------------------------------------------------------- */

      const updated =
        await updateMut.mutateAsync(
          {
            id: invoiceId,
            patch: payload,
          },
        );

      toast.success(
        `Invoice ${
          updated?.number ||
          invoice?.number ||
          ""
        } updated`,
      );

      /*
       * Go back to the invoice detail page after update.
       *
       * Existing invoice detail route is preserved.
       */
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
          isEdit
            ? "Edit Invoice"
            : "New Invoice"
        }
        description={
          isEdit
            ? "Update invoice details and items."
            : "Issuing an invoice will reduce stock for its variants"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  isEdit
                    ? `/bills/invoices/${invoiceId}`
                    : "/bills/invoices",
                )
              }
              disabled={saving}
            >
              <ArrowLeft className="h-4 w-4" />

              <span className="hidden sm:inline">
                Cancel
              </span>
            </Button>

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

      <div className="space-y-4 p-4 pb-28 md:p-6 max-w-5xl mx-auto">
        {/* ================================================================
            BASIC INVOICE DETAILS
        ================================================================ */}

        <Card>
          <CardBody>
            <FormGrid cols={2}>
              {/* Customer */}

              <Field
                label="Customer"
                required
              >
                <Select
                  value={partyId}
                  onChange={(event) =>
                    setPartyId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select customer…
                  </option>

                  {customers.map(
                    (party) => (
                      <option
                        key={party.id}
                        value={party.id}
                      >
                        {party.name}
                      </option>
                    ),
                  )}
                </Select>
              </Field>

              {/* Status */}

              <Field label="Status">
                <Select
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value,
                    )
                  }
                >
                  <option value="draft">
                    Draft
                  </option>

                  <option value="issued">
                    Issued
                  </option>
                </Select>
              </Field>

              {/* Date */}

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

              {/* Due Date */}

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
            </FormGrid>
          </CardBody>
        </Card>

        {/* ================================================================
            ITEMS

            IMPORTANT:
            Existing LineItemsEditor is untouched.
            Add / Edit / Delete behaviour remains the same.
        ================================================================ */}

        <Card>
          <CardHeader
            title="Items"
            subtitle="Search a product, then pick the attribute values configured for it in Attribute Master."
          />

          <CardBody>
            <LineItemsEditor
              items={items}
              onChange={setItems}
            />
          </CardBody>
        </Card>

        {/* ================================================================
            DISCOUNT + NOTES
        ================================================================ */}

        <Card>
          <CardBody>
            <FormGrid cols={2}>
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
            </FormGrid>
          </CardBody>
        </Card>

        {/* ================================================================
            EDIT MODE INFORMATION
        ================================================================ */}

        {isEdit &&
          invoice?.number && (
            <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-primary-600">
                Editing Invoice
              </div>

              <div className="mt-1 text-sm font-bold text-ink">
                {invoice.number}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default InvoiceFormPage;