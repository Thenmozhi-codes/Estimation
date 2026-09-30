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
import { LineItemsEditor } from "@/components/forms/LineItemsEditor";

import { toast } from "@/lib/toast";
import { useCreateQuotation } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { variantResolver } from "@/lib/api/repos";
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

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export function QuotationFormPage() {
  const navigate = useNavigate();

  const { data: parties = [] } = useParties();
  const createMut = useCreateQuotation();

  const today = new Date().toISOString().slice(0, 10);

  /* STATE */
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(today);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  /* Stops the initial empty state from overwriting an existing draft */
  const [draftLoaded, setDraftLoaded] = useState(false);

  /* RESTORE DRAFT */
  useEffect(() => {
    const draft = loadQuotationDraft();

    if (draft) {
      setPartyId(draft.partyId || "");
      setDate(draft.date || today);
      setDiscount(draft.discount ?? 0);
      setNotes(draft.notes || "");
      setItems(Array.isArray(draft.items) ? draft.items : []);

      setDraftRestored(true);
      setDraftLoaded(true);

      const timer = setTimeout(() => setDraftRestored(false), 2500);
      return () => clearTimeout(timer);
    }

    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* AUTO SAVE DRAFT */
  useEffect(() => {
    if (!draftLoaded) return;

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

    const timer = setTimeout(() => setDraftSaved(false), 1200);
    return () => clearTimeout(timer);
  }, [draftLoaded, partyId, date, discount, notes, items]);

  /* CUSTOMERS */
  const customers = useMemo(
    () =>
      parties.filter(
        (party) => party.type === "customer" || party.type === "both",
      ),
    [parties],
  );

  const selectedCustomer = useMemo(
    () => customers.find((party) => party.id === partyId) || null,
    [customers, partyId],
  );

  const customerMobile =
    selectedCustomer?.mobile ||
    selectedCustomer?.phone ||
    selectedCustomer?.mobileNumber ||
    selectedCustomer?.phoneNumber ||
    "";

  /* The repository / backend generates the real number on save */
  const quotationNumber = "Will be generated automatically";

  /* SUMMARY */
  const summary = useMemo(() => {
    let grossSubtotal = 0;
    let lineDiscountTotal = 0;
    let taxTotal = 0;

    items.forEach((item) => {
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
  }, [items, discount]);

  /* SAVE */
  const handleSave = async () => {
    if (!partyId) {
      toast.error("Select a customer");
      return;
    }

    if (!items.length) {
      toast.error("Add at least one item");
      return;
    }

    const normalizedItems = items.map((item) => ({
      ...item,
      productId: item?.productId || item?.product?.id || null,
    }));

    const invalidItemIndex = normalizedItems.findIndex(
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
      const enrichedItems = await Promise.all(
        normalizedItems.map(async (item) => {
          const variant = await variantResolver.resolveOrCreate({
            productId: item.productId,
            defaultSku: item.productSku || item.sku,
            attributeValues: item.attributeValues || {},
          });

          return {
            variantId: variant.id,
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            discount: Number(item.discount) || 0,
            taxId: item.taxId || null,
          };
        }),
      );

      const created = await createMut.mutateAsync({
        partyId,
        date,
        discount: Number(discount) || 0,
        notes,
        items: enrichedItems,
      });

      /* Only clear the draft AFTER the quotation was really created */
      clearQuotationDraft();

      toast.success(`Quotation ${created.number} created`);
      navigate(`/bills/quotations/${created.id}`);
    } catch (error) {
      console.error(error);
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
        title="New Quotation"
        description="Create a quotation for your customer"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/bills/quotations")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>

            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Quotation"}
            </Button>
          </div>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.bills} />

      <div className="mx-auto max-w-[1500px] p-4 pb-28 md:p-6">
        {/* Draft status */}
        {(draftRestored || draftSaved) && (
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

        {/* ONE FORM CARD: form sections on the left, full-height summary on the right */}
        <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-sm lg:flex-row">
          {/* ============================ LEFT — FORM ============================ */}
          <div className="min-w-0 flex-1 divide-y divide-line">
            {/* DETAILS */}
            <section className="p-4 md:p-5">
              <SectionHeading
                title="Quotation Details"
                subtitle="Enter the customer and quotation information."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Quotation No.">
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={quotationNumber}
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

                <Field label="Customer Name" required>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Select
                      value={partyId}
                      onChange={(event) => setPartyId(event.target.value)}
                      className="pl-9"
                    >
                      <option value="">Select customer…</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </Select>
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
              <SectionHeading
                title="Items"
                subtitle="Add the products and quantities included in this quotation."
              />

              <LineItemsEditor items={items} onChange={setItems} />
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

          {/* ================== RIGHT — SUMMARY (full height, ~20%) ================== */}
          <aside className="rounded-b-2xl border-t border-line bg-bg/40 lg:w-1/5 lg:min-w-[260px] lg:rounded-b-none lg:rounded-r-2xl lg:border-l lg:border-t-0">
            <div className="lg:sticky lg:top-4">
              {/* Header */}
              <div className="flex items-center gap-2 border-b border-line px-4 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Receipt className="h-4 w-4 text-primary" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Quotation Summary
                  </h3>
                  <p className="text-xs text-muted">Live calculation</p>
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

                <SummaryRow label="GST / Tax">
                  <span className="text-sm font-medium text-ink">
                    {money(summary.taxTotal)}
                  </span>
                </SummaryRow>

                {/* Grand total */}
                <div className="border-t border-dashed border-line pt-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted">Grand Total</p>
                      <p className="mt-0.5 text-xs text-muted">Including tax</p>
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

              {/* Footer note */}
              <div className="border-t border-line px-4 py-3">
                <p className="text-[11px] leading-4 text-muted">
                  Amount updates automatically when items, quantity, price or
                  discount changes.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default QuotationFormPage;