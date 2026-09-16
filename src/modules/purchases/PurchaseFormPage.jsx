import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
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
import { useCreatePurchase } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";

export function PurchaseFormPage() {
  const navigate = useNavigate();
  const { data: parties = [] } = useParties();
  const createMut = useCreatePurchase();

  const today = new Date().toISOString().slice(0, 10);

  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState("received");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);

  const suppliers = parties.filter(
    (p) => p.type === "supplier" || p.type === "both",
  );

  const handleSave = async () => {
    if (!partyId) return toast.error("Select a supplier");
    if (!items.length) return toast.error("Add at least one item");

    try {
      const payload = {
        partyId,
        date,
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
      toast.success(`Purchase ${created.number} recorded`);
      navigate(`/purchases/${created.id}`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Save failed");
    }
  };

  return (
    <>
      <PageHeader
        title="New Purchase"
        description="Stock is added when status is Received or Paid"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/purchases")}>
              <ArrowLeft className="h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={createMut.isPending}>
              <Save className="h-4 w-4" /> Save Purchase
            </Button>
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <Card>
          <CardBody>
            <FormGrid cols={2}>
              <Field label="Supplier" required>
                <Select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="received">Received</option>
                  <option value="paid">Paid</option>
                </Select>
              </Field>
              <Field label="Date">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
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