import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Switch } from "@/components/ui/Switch";
import { Sheet } from "@/components/ui/Sheet";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormGrid } from "@/components/ui/FormGrid";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "@/lib/toast";
import { formatMoney } from "@/lib/utils/money";
import { partySchema } from "@/lib/domain/schemas/party";
import {
  useParties, useCreateParty, useUpdateParty, useDeleteParty,
} from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

const emptyCustomer = () => ({
  type: "customer",
  name: "",
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

export function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const { data: allParties = [], isLoading } = useParties();
  const createMut = useCreateParty();
  const updateMut = useUpdateParty();
  const deleteMut = useDeleteParty();

  const customers = useMemo(() => {
    const base = allParties.filter(
      (p) => p.type === "customer" || p.type === "both",
    );
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone || "").includes(q) ||
        (p.gstin || "").toLowerCase().includes(q) ||
        (p.city || "").toLowerCase().includes(q),
    );
  }, [allParties, search]);

  const form = useForm({
    resolver: zodResolver(partySchema),
    defaultValues: emptyCustomer(),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyCustomer());
    setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    form.reset(row);
    setOpen(true);
  };

  const onSubmit = async (values) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, patch: values });
        toast.success("Customer updated");
      } else {
        await createMut.mutateAsync(values);
        toast.success("Customer created");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e?.message || "Save failed");
    }
  };

  const onDelete = async () => {
    await deleteMut.mutateAsync(confirm.id);
    toast.success("Customer deleted");
    setConfirm(null);
  };

  return (
    <>
      <PageHeader
        title="Customers"
        description="Your buyers — used across all quotations and invoices"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Customer</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.master} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by name, phone, GSTIN, city…"
      />

      <div className="bg-surface border-t border-line">
        <DataTable
          columns={[
            {
              key: "name",
              header: "Customer",
              sortable: true,
              render: (r) => (
                <div className="min-w-0">
                  <div className="font-semibold text-ink truncate">{r.name}</div>
                  {r.city && (
                    <div className="text-2xs text-muted">{r.city}</div>
                  )}
                </div>
              ),
            },
            {
              key: "phone",
              header: "Phone",
              hideOnMobile: true,
              render: (r) => r.phone || "—",
            },
            {
              key: "gstin",
              header: "GSTIN",
              hideOnMobile: true,
              render: (r) => r.gstin || "—",
            },
            {
              key: "openingBalance",
              header: "Opening Bal.",
              align: "right",
              hideOnMobile: true,
              render: (r) => (r.openingBalance ? formatMoney(r.openingBalance) : "—"),
            },
            {
              key: "isActive",
              header: "Status",
              align: "right",
              render: (r) => (
                <StatusBadge status={r.isActive ? "active" : "inactive"} />
              ),
            },
            {
              key: "__actions",
              header: "",
              width: 100,
              align: "right",
              render: (row) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                    className="px-2 py-1 text-2xs font-semibold text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-950/40 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirm(row); }}
                    className="px-2 py-1 text-2xs font-semibold text-danger hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                  >
                    Del
                  </button>
                </div>
              ),
            },
          ]}
          rows={customers}
          loading={isLoading}
          onRowClick={(r) => navigate(`/master/customers/${r.id}`)}
          emptyTitle="No customers yet"
          emptyDescription="Add your first customer to start creating quotations and invoices."
          emptyAction={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New Customer
            </Button>
          }
        />
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Customer" : "New Customer"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Save changes" : "Create Customer"}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormGrid cols={2}>
            <Field label="Customer name" required error={form.formState.errors.name?.message} className="sm:col-span-2">
              <Input {...form.register("name")} placeholder="e.g. Ramesh Traders" />
            </Field>
            <Field label="Phone">
              <Input {...form.register("phone")} type="tel" placeholder="e.g. 9876543210" />
            </Field>
            <Field label="Email">
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
            <Field label="Opening Balance">
              <MoneyInput {...form.register("openingBalance")} placeholder="0.00" />
            </Field>
            <Field label="Credit Limit">
              <MoneyInput {...form.register("creditLimit")} placeholder="0.00" />
            </Field>
            <Field label="Status" className="sm:col-span-2">
              <div className="flex items-center h-9">
                <Switch
                  checked={form.watch("isActive")}
                  onChange={(v) => form.setValue("isActive", v)}
                  label={form.watch("isActive") ? "Active" : "Inactive"}
                />
              </div>
            </Field>
          </FormGrid>
        </form>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete customer?"
        description={`"${confirm?.name}" will be removed. Transaction history stays.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </>
  );
}