import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Card, CardBody } from "@/components/ui/Card";
import { FormGrid } from "@/components/ui/FormGrid";
import { LineItemsEditor } from "@/components/forms/LineItemsEditor";
import { toast } from "@/lib/toast";
import { useCreateInvoice } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const { data: parties = [] } = useParties();
  const createMut = useCreateInvoice();

  const today = new Date().toISOString().slice(0, 10);

  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("issued");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);

  const customers = parties.filter(
    (p) => p.type === "customer" || p.type === "both",
  );

  const handleSave = async () => {
    if (!partyId) return toast.error("Select a customer");
    if (!items.length) return toast.error("Add at least one item");

    try {
      const payload = {
        partyId,
        date,
        dueDate: dueDate || null,
        status,
        discount: Number(discount) || 0,
        notes,
        items: items.map((it) => ({
          variantId: it.variantId,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          taxId: it.taxId || null,
        })),
      };
      const created = await createMut.mutateAsync(payload);
      toast.success(`Invoice ${created.number} created`);
      navigate(`/sales/invoices/${created.id}`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Save failed");
    }
  };

  return (
    <>
      <PageHeader
        title="New Invoice"
        description="Issuing an invoice will reduce stock for its variants"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/sales/invoices")}
            >
              <ArrowLeft className="h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={createMut.isPending}>
              <Save className="h-4 w-4" /> Save Invoice
            </Button>
          </div>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.sales} />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <Card>
          <CardBody>
            <FormGrid cols={2}>
              <Field label="Customer" required>
                <Select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                >
                  <option value="">Select customer…</option>
                  {customers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                </Select>
              </Field>
              <Field label="Date">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Due Date">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </FormGrid>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-timber-700 mb-3">
              Items
            </div>
            <LineItemsEditor items={items} onChange={setItems} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <FormGrid cols={2}>
              <Field label="Header discount">
                <MoneyInput
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </FormGrid>
          </CardBody>
        </Card>
      </div>
    </>
  );
}