import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Sheet } from "@/components/ui/Sheet";

import { toast } from "@/lib/toast";
import { partySchema } from "@/lib/domain/schemas/party";
import { useCreateParty } from "@/hooks/useParties";

const emptyCustomer = (name = "") => ({
  type: "customer",
  name,
  phone: "",
  email: "",
  gstin: "",
  state: "",
  city: "",
  address: "",
  creditLimit: 0,
  openingBalance: 0,
  isActive: true,
});

/*
 * Create a customer without leaving the quotation / invoice form.
 * Uses the same schema + create hook as Master -> Customers, then hands the
 * new customer back through onCreated(customer) so the form can select it.
 */
export function CustomerQuickAddSheet({ open, onClose, onCreated, initialName = "" }) {
  const createMut = useCreateParty();

  const form = useForm({
    resolver: zodResolver(partySchema),
    defaultValues: emptyCustomer(initialName),
  });

  /* fresh form every time the sheet opens */
  useEffect(() => {
    if (open) form.reset(emptyCustomer(initialName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (values) => {
    try {
      const created = await createMut.mutateAsync(values);
      toast.success("Customer created");
      onCreated?.(created);
      onClose?.();
    } catch (error) {
      toast.error(error?.message || "Could not create customer");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New Customer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create Customer"}
          </Button>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormGrid cols={2}>
          <Field
            label="Customer name"
            required
            error={form.formState.errors.name?.message}
            className="sm:col-span-2"
          >
            <Input {...form.register("name")} placeholder="e.g. Ramesh Traders" autoFocus />
          </Field>

          <Field label="Phone">
            <Input {...form.register("phone")} type="tel" placeholder="e.g. 9876543210" />
          </Field>

          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input {...form.register("email")} type="email" placeholder="optional" />
          </Field>

          <Field label="GSTIN" className="sm:col-span-2">
            <Input {...form.register("gstin")} placeholder="optional" />
          </Field>

          <Field label="State">
            <Input {...form.register("state")} placeholder="e.g. Tamil Nadu" />
          </Field>

          <Field label="City">
            <Input {...form.register("city")} placeholder="e.g. Chennai" />
          </Field>

          <Field label="Address" className="sm:col-span-2">
            <Textarea {...form.register("address")} rows={2} placeholder="Street, area, PIN" />
          </Field>
        </FormGrid>
      </form>
    </Sheet>
  );
}

export default CustomerQuickAddSheet;
