import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormGrid } from "@/components/ui/FormGrid";
import { StatusBadge } from "@/components/ui/StatusBadge";

import { toast } from "@/lib/toast";
import { formatMoney } from "@/lib/utils/money";
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
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const {
    data: allParties = [],
    isLoading,
  } = useParties();

  const createMut = useCreateParty();
  const updateMut = useUpdateParty();
  const deleteMut = useDeleteParty();

  /*
   * ---------------------------------------------------------
   * CUSTOMERS
   * ---------------------------------------------------------
   *
   * Existing customer logic is preserved.
   */

  const customers = useMemo(() => {
    const base = allParties.filter(
      (party) =>
        party.type === "customer" ||
        party.type === "both",
    );

    const q = search.trim().toLowerCase();

    if (!q) {
      return base;
    }

    return base.filter((party) => {
      return (
        party.name
          .toLowerCase()
          .includes(q) ||
        (party.phone || "")
          .toLowerCase()
          .includes(q) ||
        (party.gstin || "")
          .toLowerCase()
          .includes(q) ||
        (party.city || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [allParties, search]);

  /*
   * ---------------------------------------------------------
   * FORM
   * ---------------------------------------------------------
   */

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

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
  };

  /*
   * ---------------------------------------------------------
   * SAVE
   * ---------------------------------------------------------
   */

  const onSubmit = async (values) => {
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

      closeForm();
    } catch (error) {
      toast.error(
        error?.message || "Save failed",
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * DELETE
   * ---------------------------------------------------------
   */

  const onDelete = async () => {
    if (!confirm) return;

    try {
      await deleteMut.mutateAsync(confirm.id);

      toast.success("Customer deleted");

      setConfirm(null);
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not delete customer",
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="page-container min-h-full">
      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <PageHeader
        title="Customers"
        description="Manage your customers used across quotations and invoices."
        actions={
          <Button
            size="sm"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />

            <span className="hidden sm:inline">
              New Customer
            </span>

            <span className="sm:hidden">
              New
            </span>
          </Button>
        }
      />

      {/* =====================================================
          MASTER TABS
          ===================================================== */}

      <ModuleTabs
        tabs={MODULE_TABS.master}
      />

      {/* =====================================================
          CUSTOMER MASTER FRAME
          ===================================================== */}

      <div
        className="
          mb-24
          w-full
          overflow-hidden
          rounded-xl
          border
          border-line
          bg-surface
          md:mb-6
        "
      >
        {/* ---------------------------------------------------
            FRAME HEADER
            --------------------------------------------------- */}

        <div
          className="
            flex
            flex-col
            gap-3
            border-b
            border-line
            px-5
            py-3.5
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          {/* Left */}
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-ink">
              Customer Master
            </div>

            <div className="mt-0.5 text-2xs text-muted">
              Manage customer details used across your business.
            </div>
          </div>

          {/* Right — Search */}
          <div className="relative w-full sm:w-[235px]">
            <Search
              className="
                pointer-events-none
                absolute
                left-3
                top-1/2
                h-3.5
                w-3.5
                -translate-y-1/2
                text-muted
              "
              strokeWidth={2}
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search customers..."
              className="
                h-9
                w-full
                rounded-lg
                border
                border-line
                bg-bg
                pl-9
                pr-3
                text-sm
                text-ink
                outline-none
                placeholder:text-subtle
                transition-all
                hover:border-muted/40
                focus:border-primary-500
                focus:ring-2
                focus:ring-primary-500/15
              "
            />
          </div>
        </div>

        {/* ---------------------------------------------------
            CUSTOMER LIST
            --------------------------------------------------- */}

        <div className="w-full">
          <DataTable
            columns={[
              {
                key: "name",
                header: "Customer",
                sortable: true,

                render: (row) => (
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">
                      {row.name}
                    </div>

                    {row.city && (
                      <div className="text-2xs text-muted">
                        {row.city}
                      </div>
                    )}
                  </div>
                ),
              },

              {
                key: "phone",
                header: "Phone",
                hideOnMobile: true,

                render: (row) =>
                  row.phone || "—",
              },

              {
                key: "gstin",
                header: "GSTIN",
                hideOnMobile: true,

                render: (row) =>
                  row.gstin || "—",
              },

              {
                key: "openingBalance",
                header: "Opening Bal.",
                align: "right",
                hideOnMobile: true,

                render: (row) =>
                  row.openingBalance
                    ? formatMoney(
                        row.openingBalance,
                      )
                    : "—",
              },

              {
                key: "isActive",
                header: "Status",
                align: "right",

                render: (row) => (
                  <StatusBadge
                    status={
                      row.isActive
                        ? "active"
                        : "inactive"
                    }
                  />
                ),
              },

              {
                key: "__actions",
                header: "",
                width: 120,
                align: "right",

                render: (row) => (
                  <div className="flex items-center justify-end gap-1">
                    {/* Edit */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        openEdit(row);
                      }}
                      className="
                        rounded-lg
                        px-2.5
                        py-1.5
                        text-2xs
                        font-semibold
                        text-primary-600
                        transition-colors
                        hover:bg-primary-500/10
                      "
                    >
                      Edit
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        setConfirm(row);
                      }}
                      className="
                        rounded-lg
                        px-2.5
                        py-1.5
                        text-2xs
                        font-semibold
                        text-danger
                        transition-colors
                        hover:bg-red-50
                        dark:hover:bg-red-950/40
                      "
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={customers}
            loading={isLoading}
            onRowClick={(row) =>
              navigate(
                `/master/customers/${row.id}`,
              )
            }
            emptyTitle={
              search
                ? "No customers found"
                : "No customers yet"
            }
            emptyDescription={
              search
                ? "Try a different name, phone, GSTIN or city."
                : "Add your first customer to start creating quotations and invoices."
            }
            emptyAction={
              !search ? (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  New Customer
                </Button>
              ) : null
            }
          />
        </div>
      </div>

      {/* =====================================================
          CUSTOMER FORM
          ===================================================== */}

      <Sheet
        open={open}
        onClose={closeForm}
        title={
          editing
            ? "Edit Customer"
            : "New Customer"
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={closeForm}
            >
              Cancel
            </Button>

            <Button
              onClick={form.handleSubmit(
                onSubmit,
              )}
              disabled={
                createMut.isPending ||
                updateMut.isPending
              }
            >
              {editing
                ? "Save changes"
                : "Create Customer"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={form.handleSubmit(
            onSubmit,
          )}
          className="space-y-4"
        >
          <FormGrid cols={2}>
            {/* Customer Name */}
            <Field
              label="Customer name"
              required
              error={
                form.formState.errors.name
                  ?.message
              }
              className="sm:col-span-2"
            >
              <Input
                {...form.register("name")}
                placeholder="e.g. Ramesh Traders"
              />
            </Field>

            {/* Phone */}
            <Field label="Phone">
              <Input
                {...form.register("phone")}
                type="tel"
                placeholder="e.g. 9876543210"
              />
            </Field>

            {/* Email */}
            <Field label="Email">
              <Input
                {...form.register("email")}
                type="email"
                placeholder="optional"
              />
            </Field>

            {/* GSTIN */}
            <Field
              label="GSTIN"
              className="sm:col-span-2"
            >
              <Input
                {...form.register("gstin")}
                placeholder="optional"
              />
            </Field>

            {/* State */}
            <Field label="State">
              <Input
                {...form.register("state")}
                placeholder="e.g. Tamil Nadu"
              />
            </Field>

            {/* City */}
            <Field label="City">
              <Input
                {...form.register("city")}
                placeholder="e.g. Chennai"
              />
            </Field>

            {/* Address */}
            <Field
              label="Address"
              className="sm:col-span-2"
            >
              <Textarea
                {...form.register("address")}
                rows={2}
                placeholder="Street, area, PIN"
              />
            </Field>

            {/* Opening Balance */}
            <Field label="Opening Balance">
              <MoneyInput
                {...form.register(
                  "openingBalance",
                )}
                placeholder="0.00"
              />
            </Field>

            {/* Credit Limit */}
            <Field label="Credit Limit">
              <MoneyInput
                {...form.register(
                  "creditLimit",
                )}
                placeholder="0.00"
              />
            </Field>

            {/* Status */}
            <Field
              label="Status"
              className="sm:col-span-2"
            >
              <div className="flex h-9 items-center">
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
                  label={
                    form.watch("isActive")
                      ? "Active"
                      : "Inactive"
                  }
                />
              </div>
            </Field>
          </FormGrid>
        </form>
      </Sheet>

      {/* =====================================================
          DELETE CONFIRMATION
          ===================================================== */}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete customer?"
        description={
          confirm
            ? `"${confirm.name}" will be removed. Transaction history stays.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </div>
  );
}

export default CustomersPage;