import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
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
import { PARTY_TYPE_OPTIONS } from "@/lib/domain/options";
import {
  useParties,
  useCreateParty,
  useUpdateParty,
  useDeleteParty,
} from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

/**
 * One component serves both Customers and Suppliers.
 * The `type` prop decides which subset to show + the default for new records.
 */
export function PartiesPage({ type }) {
  const isCustomer = type === "customer";
  const isSupplier = type === "supplier";

  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const { data: allParties = [], isLoading } = useParties();
  const createMut = useCreateParty();
  const updateMut = useUpdateParty();
  const deleteMut = useDeleteParty();

  const rows = useMemo(() => {
    const filtered = allParties.filter((p) => {
      if (isCustomer) return p.type === "customer" || p.type === "both";
      if (isSupplier) return p.type === "supplier" || p.type === "both";
      return true;
    });
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone || "").includes(q) ||
        (p.gstin || "").toLowerCase().includes(q) ||
        (p.city || "").toLowerCase().includes(q),
    );
  }, [allParties, search, isCustomer, isSupplier]);

  const form = useForm({
    resolver: zodResolver(partySchema),
    defaultValues: {
      type,
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
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      type,
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
        toast.success(`${isCustomer ? "Customer" : "Supplier"} updated`);
      } else {
        await createMut.mutateAsync(values);
        toast.success(`${isCustomer ? "Customer" : "Supplier"} created`);
      }
      setOpen(false);
    } catch (e) {
      toast.error(e?.message || "Save failed");
    }
  };

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(confirm.id);
      toast.success("Party deleted");
      setConfirm(null);
    } catch (e) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const title = isCustomer ? "Customers" : "Suppliers";
  const description = isCustomer
    ? "All customers you sell to"
    : "All suppliers you purchase from";
  const entityLabel = isCustomer ? "Customer" : "Supplier";

  // Sync module tab highlight with route
  const tabs = MODULE_TABS.parties;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New {entityLabel}</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <ModuleTabs tabs={tabs} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder={`Search ${title.toLowerCase()}…`}
      />

      <div className="bg-white border-t border-line">
        <DataTable
          columns={[
            {
              key: "name",
              header: entityLabel,
              sortable: true,
              render: (r) => (
                <div className="min-w-0">
                  <div className="font-semibold text-timber-700 truncate">
                    {r.name}
                  </div>
                  {r.city && (
                    <div className="text-[11px] text-muted">{r.city}</div>
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
              key: "creditLimit",
              header: "Credit Limit",
              align: "right",
              hideOnMobile: true,
              render: (r) => (r.creditLimit ? formatMoney(r.creditLimit) : "—"),
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
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(row);
                    }}
                    className="px-2 py-1 text-xs font-semibold text-timber-700 hover:bg-timber-100 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirm(row);
                    }}
                    className="px-2 py-1 text-xs font-semibold text-danger hover:bg-red-50 rounded"
                  >
                    Del
                  </button>
                </div>
              ),
            },
          ]}
          rows={rows}
          loading={isLoading}
          onRowClick={(r) =>
            navigate(`/parties/${isCustomer ? "customers" : "suppliers"}/${r.id}`)
          }
          emptyTitle={`No ${title.toLowerCase()} yet`}
          emptyDescription={`Add your first ${entityLabel.toLowerCase()} to start ${isCustomer ? "selling" : "buying"}.`}
          emptyAction={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New {entityLabel}
            </Button>
          }
        />
      </div>

      {/* Create / Edit sheet */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${entityLabel}` : `New ${entityLabel}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editing ? "Save changes" : `Create ${entityLabel}`}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormGrid cols={2}>
            <Field
              label={`${entityLabel} name`}
              required
              error={form.formState.errors.name?.message}
              className="sm:col-span-2"
            >
              <Input
                {...form.register("name")}
                placeholder="e.g. Ramesh Traders"
              />
            </Field>

            <Field label="Phone" error={form.formState.errors.phone?.message}>
              <Input
                {...form.register("phone")}
                placeholder="e.g. 9876543210"
                type="tel"
              />
            </Field>

            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input
                {...form.register("email")}
                placeholder="e.g. ramesh@example.com"
                type="email"
              />
            </Field>

            <Field
              label="GSTIN"
              error={form.formState.errors.gstin?.message}
              className="sm:col-span-2"
            >
              <Input
                {...form.register("gstin")}
                placeholder="e.g. 33AAAPZ1234C1Z1"
              />
            </Field>

            <Field label="State">
              <Input {...form.register("state")} placeholder="e.g. Tamil Nadu" />
            </Field>

            <Field label="City">
              <Input {...form.register("city")} placeholder="e.g. Chennai" />
            </Field>

            <Field label="Address" className="sm:col-span-2">
              <Textarea
                {...form.register("address")}
                rows={2}
                placeholder="Street, area, PIN"
              />
            </Field>

            <Field label="Credit Limit">
              <MoneyInput
                {...form.register("creditLimit")}
                placeholder="0.00"
              />
            </Field>

            <Field label="Opening Balance">
              <MoneyInput
                {...form.register("openingBalance")}
                placeholder="0.00"
              />
            </Field>

            <Field label="Party type" className="sm:col-span-2">
              <Select {...form.register("type")}>
                {PARTY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
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
        title={`Delete ${entityLabel.toLowerCase()}?`}
        description={`"${confirm?.name}" will be removed. Its transaction history will remain.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </>
  );
}