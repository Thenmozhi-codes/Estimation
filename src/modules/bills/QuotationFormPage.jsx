import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  RotateCcw,
  Save,
  Smartphone,
} from "lucide-react";

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
import { useCreateQuotation } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { variantResolver } from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

export function QuotationFormPage() {
  const navigate = useNavigate();

  const { data: parties = [] } = useParties();
  const createMut = useCreateQuotation();

  const today = new Date().toISOString().slice(0, 10);

  // ------------------------------------------------------------
  // FORM STATE
  // ------------------------------------------------------------

  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(today);

  // Kept internally for existing backend compatibility.
  // Not shown in the UI.
  const [validUntil] = useState("");

  // Kept internally for existing backend compatibility.
  // Not shown in the UI.
  const [status] = useState("draft");

  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // ------------------------------------------------------------
  // CUSTOMERS
  // ------------------------------------------------------------

  const customers = useMemo(
    () =>
      parties.filter(
        (p) => p.type === "customer" || p.type === "both",
      ),
    [parties],
  );

  const selectedCustomer = useMemo(
    () => customers.find((p) => p.id === partyId),
    [customers, partyId],
  );

  // Support the common phone field names used by party data.
  const customerPhone =
    selectedCustomer?.phone ??
    selectedCustomer?.mobile ??
    selectedCustomer?.phoneNumber ??
    selectedCustomer?.contactNumber ??
    "";

  // ------------------------------------------------------------
  // RESET
  // ------------------------------------------------------------

  const handleReset = () => {
    setPartyId("");
    setDate(today);
    setDiscount(0);
    setNotes("");
    setItems([]);

    toast.success("Quotation form reset");
  };

  // ------------------------------------------------------------
  // SAVE
  // ------------------------------------------------------------

  const handleSave = async () => {
    if (!partyId) {
      return toast.error("Select a customer");
    }

    if (!items.length) {
      return toast.error("Add at least one item");
    }

    setSaving(true);

    try {
      const enrichedItems = await Promise.all(
        items.map(async (it) => {
          const variant = await variantResolver.resolveOrCreate({
            productId: it.productId,
            defaultSku: it.productSku || it.sku,
            attributeValues: it.attributeValues || {},
          });

          return {
            variantId: variant.id,
            quantity: Number(it.quantity) || 0,
            unitPrice: Number(it.unitPrice) || 0,
            discount: Number(it.discount) || 0,
            taxId: it.taxId || null,
          };
        }),
      );

      const payload = {
        partyId,
        date,
        validUntil: validUntil || null,
        status,
        discount: Number(discount) || 0,
        notes,
        items: enrichedItems,
      };

      const created = await createMut.mutateAsync(payload);

      toast.success(`Quotation ${created.number} created`);

      navigate(`/bills/quotations/${created.id}`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <div className="page-container min-h-full bg-surface">

      {/* ========================================================
          PAGE HEADER
      ======================================================== */}

      <PageHeader
        title="New Quotation"
        description="Create a professional quotation for your customer"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/bills/quotations")}
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

      <ModuleTabs tabs={MODULE_TABS.bills} />

      {/* ========================================================
          MAIN CONTENT
      ======================================================== */}

      <div className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-6">

        {/* ======================================================
            QUOTATION DETAILS
        ====================================================== */}

        <Card className="overflow-hidden">

          {/* Section Header */}
          <div className="border-b border-line bg-surface px-5 py-4">
            <div className="flex items-center justify-between gap-4">

              <div className="flex items-center gap-3">

                {/* Icon */}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
                  <FileText className="h-5 w-5" />
                </div>

                {/* Title */}
                <div>
                  <h2 className="text-sm font-black text-ink">
                    Quotation Details
                  </h2>

                  <p className="mt-0.5 text-xs text-muted">
                    Basic quotation information
                  </p>
                </div>

              </div>

              {/* Reset */}
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />

                Reset
              </button>

            </div>
          </div>

          {/* ====================================================
              DETAILS BODY
          ==================================================== */}

          <CardBody className="p-5">

            {/* ==================================================
                QUOTATION NUMBER + DATE
            ================================================== */}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              {/* Quotation Number */}
              <div className="rounded-xl border border-line bg-surface-2 p-4">

                <div className="mb-2 flex items-center justify-between">

                  <span className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Quotation No.
                  </span>

                  <span className="rounded-md bg-ink px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white">
                    Auto
                  </span>

                </div>

                <div className="text-base font-black tracking-wide text-ink">
                  Auto-generated
                </div>

                <p className="mt-1 text-[11px] text-muted">
                  Number will be assigned when the quotation is saved.
                </p>

              </div>

              {/* Quotation Date */}
              <div className="rounded-xl border border-line bg-surface-2 p-4">

                <div className="mb-2 flex items-center justify-between">

                  <span className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Quotation Date
                  </span>

                  <CalendarDays className="h-4 w-4 text-muted" />

                </div>

                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-0 bg-transparent p-0 text-sm font-bold shadow-none focus:ring-0"
                />

              </div>

            </div>

            {/* ==================================================
                CUSTOMER
            ================================================== */}

            <div className="mt-5 border-t border-line pt-5">

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                {/* Customer Name */}
                <Field
                  label="Customer"
                  required
                >
                  <Select
                    value={partyId}
                    onChange={(e) =>
                      setPartyId(e.target.value)
                    }
                    className="h-11"
                  >
                    <option value="">
                      Select customer...
                    </option>

                    {customers.map((customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/* Mobile Number */}
                <Field label="Mobile Number">
                  <div className="flex h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3">

                    <Smartphone className="h-4 w-4 shrink-0 text-muted" />

                    {selectedCustomer ? (
                      <span className="text-sm font-semibold text-ink">
                        {customerPhone ||
                          "No mobile number available"}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">
                        Select a customer
                      </span>
                    )}

                  </div>
                </Field>

              </div>

            </div>

          </CardBody>
        </Card>

        {/* ========================================================
            QUOTATION ITEMS
        ======================================================== */}

        <Card>

          <CardHeader
            title="Quotation Items"
            subtitle="Search a product, then pick the attribute values configured for it in Attribute Master."
          />

          <CardBody>
            <LineItemsEditor
              items={items}
              onChange={setItems}
            />
          </CardBody>

        </Card>

        {/* ========================================================
            DISCOUNT + NOTES
        ======================================================== */}

        <Card>

          <CardBody>

            <FormGrid cols={2}>

              {/* Discount */}
              <Field label="Header discount">
                <MoneyInput
                  value={discount}
                  onChange={(e) =>
                    setDiscount(e.target.value)
                  }
                />
              </Field>

              {/* Notes */}
              <Field label="Notes">
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value)
                  }
                  placeholder="Optional"
                />
              </Field>

            </FormGrid>

          </CardBody>

        </Card>

      </div>

      {/* ==========================================================
          MOBILE BOTTOM SAVE BAR
      ========================================================== */}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur md:hidden">

        <div className="mx-auto flex max-w-6xl gap-2">

          <Button
            variant="outline"
            className="flex-1"
            onClick={() =>
              navigate("/bills/quotations")
            }
          >
            Cancel
          </Button>

          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4" />

            {saving
              ? "Saving…"
              : "Save Quotation"}
          </Button>

        </div>

      </div>

    </div>
  );
}

export default QuotationFormPage;