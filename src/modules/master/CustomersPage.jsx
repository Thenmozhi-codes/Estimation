import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

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
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";

import { toast } from "@/lib/toast";
import { partySchema } from "@/lib/domain/schemas/party";

import {
  useParties,
  useCreateParty,
  useUpdateParty,
  useDeleteParty,
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
  const [editing, setEditing] =
    useState(null);
  const [confirm, setConfirm] =
    useState(null);

  const {
    data: parties = [],
    isLoading,
  } = useParties();

  const createMut = useCreateParty();
  const updateMut = useUpdateParty();
  const deleteMut = useDeleteParty();

  const customers = useMemo(() => {
    const base = parties.filter(
      (party) =>
        party.type === "customer" ||
        party.type === "both",
    );

    const q = search
      .trim()
      .toLowerCase();

    if (!q) return base;

    return base.filter(
      (party) =>
        party.name
          ?.toLowerCase()
          .includes(q) ||
        party.phone
          ?.toLowerCase()
          .includes(q) ||
        party.gstin
          ?.toLowerCase()
          .includes(q) ||
        party.city
          ?.toLowerCase()
          .includes(q),
    );
  }, [parties, search]);

  const form = useForm({
    resolver: zodResolver(partySchema),
    defaultValues: emptyCustomer(),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyCustomer());
    setOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    form.reset(customer);
    setOpen(true);
  };

  const submit = async (values) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          patch: values,
        });

        toast.success("Customer updated");
      } else {
        await createMut.mutateAsync(values);

        toast.success("Customer created");
      }

      setOpen(false);
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to save customer",
      );
    }
  };

  const deleteCustomer = async () => {
    try {
      await deleteMut.mutateAsync(
        confirm.id,
      );

      toast.success("Customer deleted");
      setConfirm(null);
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to delete customer",
      );
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Customers"
        description="Manage the people and businesses you sell to."
        actions={
          <Button
            size="sm"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            New Customer
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-24 md:pb-8">
        {/* Search + count */}
        <Card className="mb-4">
          <div className="p-3 flex items-center gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search name, phone, GSTIN or city…"
                className="
                  w-full
                  h-10
                  pl-9
                  pr-3
                  rounded-xl
                  bg-bg
                  border
                  border-line
                  text-sm
                  text-ink
                  placeholder:text-subtle
                  focus:border-primary-500
                  focus:ring-2
                  focus:ring-primary-500/10
                "
              />
            </div>

            <div className="hidden sm:block text-xs text-muted ml-auto">
              {customers.length} customers
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card>
            <CardBody className="p-8 text-sm text-muted">
              Loading customers…
            </CardBody>
          </Card>
        ) : customers.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title={
                search
                  ? "No customers found"
                  : "No customers yet"
              }
              description={
                search
                  ? "Try a different search term."
                  : "Add your first customer to start creating quotations and invoices."
              }
              action={
                !search && (
                  <Button
                    size="sm"
                    onClick={openCreate}
                  >
                    <Plus className="h-4 w-4" />
                    Add customer
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {customers.map(
              (customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onOpen={() =>
                    navigate(
                      `/master/customers/${customer.id}`,
                    )
                  }
                  onEdit={() =>
                    openEdit(customer)
                  }
                  onDelete={() =>
                    setConfirm(customer)
                  }
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Customer form */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? "Edit customer"
            : "New customer"
        }
        subtitle="Customer details are reused across quotations and invoices."
        width="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button
              onClick={form.handleSubmit(
                submit,
              )}
              loading={
                createMut.isPending ||
                updateMut.isPending
              }
            >
              {editing
                ? "Save changes"
                : "Create customer"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={form.handleSubmit(
            submit,
          )}
          className="space-y-6"
        >
          <section>
            <div className="text-xs font-bold text-ink">
              Basic information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Field
                label="Customer name"
                required
                className="sm:col-span-2"
                error={
                  form.formState.errors
                    .name?.message
                }
              >
                <Input
                  {...form.register("name")}
                  placeholder="e.g. Sri Lakshmi Interiors"
                />
              </Field>

              <Field label="Phone">
                <Input
                  {...form.register(
                    "phone",
                  )}
                  type="tel"
                  placeholder="9876543210"
                />
              </Field>

              <Field label="Email">
                <Input
                  {...form.register(
                    "email",
                  )}
                  type="email"
                  placeholder="optional"
                />
              </Field>

              <Field label="GSTIN">
                <Input
                  {...form.register(
                    "gstin",
                  )}
                  placeholder="optional"
                />
              </Field>
            </div>
          </section>

          <section>
            <div className="text-xs font-bold text-ink">
              Address
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Field label="State">
                <Input
                  {...form.register(
                    "state",
                  )}
                  placeholder="Tamil Nadu"
                />
              </Field>

              <Field label="City">
                <Input
                  {...form.register(
                    "city",
                  )}
                  placeholder="Chennai"
                />
              </Field>

              <Field
                label="Address"
                className="sm:col-span-2"
              >
                <Textarea
                  {...form.register(
                    "address",
                  )}
                  rows={3}
                  placeholder="Street, area, PIN"
                />
              </Field>
            </div>
          </section>

          <section>
            <div className="text-xs font-bold text-ink">
              Financial settings
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Field label="Opening balance">
                <MoneyInput
                  {...form.register(
                    "openingBalance",
                  )}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Credit limit">
                <MoneyInput
                  {...form.register(
                    "creditLimit",
                  )}
                  placeholder="0.00"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-bg p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-ink">
                  Customer status
                </div>

                <div className="text-[11px] text-muted mt-0.5">
                  Inactive customers won't be suggested
                  for new documents.
                </div>
              </div>

              <Switch
                checked={form.watch(
                  "isActive",
                )}
                onChange={(value) =>
                  form.setValue(
                    "isActive",
                    value,
                  )
                }
              />
            </div>
          </section>
        </form>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={deleteCustomer}
        title="Delete customer?"
        description={`"${confirm?.name}" will be removed. Existing transaction history stays intact.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </div>
  );
}

function CustomerCard({
  customer,
  onOpen,
  onEdit,
  onDelete,
}) {
  const initials =
    customer.name
      ?.split(" ")
      .filter(Boolean)
      .map(
        (part) => part[0],
      )
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CU";

  return (
    <Card
      interactive
      className="group"
    >
      <CardBody>
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-ink truncate">
                    {customer.name}
                  </div>

                  <div className="text-[10px] text-muted mt-0.5">
                    {customer.gstin ||
                      "No GSTIN"}
                  </div>
                </div>

                <StatusBadge
                  status={
                    customer.isActive
                      ? "active"
                      : "inactive"
                  }
                />
              </div>

              <div className="space-y-1.5 mt-4">
                {customer.phone && (
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>
                      {customer.phone}
                    </span>
                  </div>
                )}

                {(customer.city ||
                  customer.state) && (
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <MapPin className="h-3 w-3 shrink-0" />

                    <span className="truncate">
                      {[
                        customer.city,
                        customer.state,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-line">
          <Button
            size="xs"
            variant="secondary"
            onClick={onOpen}
          >
            View customer
          </Button>

          <button
            type="button"
            onClick={onEdit}
            className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-muted hover:text-ink hover:bg-bg"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-danger/70 hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardBody>
    </Card>
  );
}