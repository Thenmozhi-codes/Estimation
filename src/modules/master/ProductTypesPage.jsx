import { useMemo, useState } from "react";
import { Plus, Settings2, Trash2, Check } from "lucide-react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";

import { categorySchema } from "@/lib/domain/schemas/master";

import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useAttributes,
  useCategoryAttributes,
  useUpsertCategoryAttribute,
} from "@/hooks/useMasters";

import { categoryAttributeRepo } from "@/lib/api/repos";
import { useQueryClient } from "@tanstack/react-query";
import { MODULE_TABS } from "@/app/moduleNav";

export function ProductTypesPage() {
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const {
    data: types = [],
    isLoading,
  } = useCategories();

  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();

  const form = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      isActive: true,
    },
  });

  const openCreate = () => {
    setEdit("new");

    form.reset({
      name: "",
      code: "",
      description: "",
      isActive: true,
    });
  };

  const openEdit = (type) => {
    setEdit(type);

    form.reset({
      name: type.name || "",
      code: type.code || "",
      description: type.description || "",
      isActive: type.isActive ?? true,
    });
  };

  const submit = async (values) => {
    try {
      if (edit === "new") {
        await createMut.mutateAsync(values);
        toast.success("Product type created");
      } else {
        await updateMut.mutateAsync({
          id: edit.id,
          patch: values,
        });

        toast.success("Product type updated");
      }

      setEdit(null);
    } catch (error) {
      toast.error(
        error?.message || "Unable to save product type",
      );
    }
  };

  const deleteType = async () => {
    try {
      await deleteMut.mutateAsync(confirm.id);

      toast.success("Product type deleted");

      setConfirm(null);
      setSelected(null);
    } catch (error) {
      toast.error(
        error?.message || "Unable to delete product type",
      );
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Product Types"
        description="Define how your products are grouped and which attributes they use."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Product Type
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-24 md:pb-8">
        {/* Intro stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          <MiniStat
            label="Product types"
            value={types.length}
          />

          <MiniStat
            label="Configuration"
            value="Per type"
          />

          <MiniStat
            label="Setup"
            value="Reusable"
            className="hidden lg:block"
          />
        </div>

        {/* Main list */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-ink">
                Your product types
              </div>

              <div className="text-xs text-muted mt-0.5">
                Select a type to configure its attributes.
              </div>
            </div>

            <div className="text-[11px] text-muted">
              {types.length} total
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-sm text-muted">
              Loading product types…
            </div>
          ) : types.length === 0 ? (
            <EmptyState
              title="No product types yet"
              description="Create your first type, such as Plywood, Laminate or WPC."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Create product type
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {types.map((type) => (
                <ProductTypeRow
                  key={type.id}
                  type={type}
                  onConfigure={() => setSelected(type)}
                  onEdit={() => openEdit(type)}
                  onDelete={() => setConfirm(type)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Create / Edit */}
      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={
          edit === "new"
            ? "Create product type"
            : "Edit product type"
        }
        subtitle="Keep the type simple. Attributes are configured separately."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setEdit(null)}
            >
              Cancel
            </Button>

            <Button
              onClick={form.handleSubmit(submit)}
              loading={
                createMut.isPending ||
                updateMut.isPending
              }
            >
              {edit === "new" ? "Create type" : "Save changes"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={form.handleSubmit(submit)}
          className="space-y-5"
        >
          <Field
            label="Name"
            required
            error={
              form.formState.errors.name?.message
            }
          >
            <Input
              {...form.register("name")}
              placeholder="e.g. Plywood"
            />
          </Field>

          <Field
            label="Code"
            required
            hint="Used internally to identify the type."
            error={
              form.formState.errors.code?.message
            }
          >
            <Input
              {...form.register("code")}
              placeholder="e.g. PLYWOOD"
            />
          </Field>

          <Field label="Description">
            <Textarea
              {...form.register("description")}
              rows={4}
              placeholder="Optional description"
            />
          </Field>
        </form>
      </Sheet>

      {/* Attribute configuration */}
      <AttributeConfiguration
        type={selected}
        onClose={() => setSelected(null)}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={deleteType}
        title="Delete product type?"
        description={`"${confirm?.name}" will be removed. Products using this type may no longer be grouped correctly.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </div>
  );
}

function ProductTypeRow({
  type,
  onConfigure,
  onEdit,
  onDelete,
}) {
  return (
    <div
      className="
        group
        px-4 md:px-5
        py-4
        flex
        items-center
        gap-4
        hover:bg-bg/60
        transition-colors
      "
    >
      <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold">
          {type.name?.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink truncate">
          {type.name}
        </div>

        <div className="text-[11px] text-muted mt-0.5">
          {type.code}
        </div>
      </div>

      <div className="hidden sm:block text-right mr-3">
        <div className="text-[10px] uppercase tracking-wider text-subtle">
          Attributes
        </div>

        <div className="text-xs font-semibold text-ink mt-0.5">
          Configure
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={onConfigure}
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            Configure
          </span>
        </Button>

        <button
          type="button"
          onClick={onEdit}
          className="h-8 px-2.5 rounded-lg text-xs font-semibold text-muted hover:text-ink hover:bg-bg"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-danger/70 hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
          aria-label={`Delete ${type.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  className,
}) {
  return (
    <Card className={className}>
      <CardBody className="py-3.5">
        <div className="text-[10px] uppercase tracking-wider text-subtle">
          {label}
        </div>

        <div className="text-lg font-bold text-ink mt-1 tabular-nums">
          {value}
        </div>
      </CardBody>
    </Card>
  );
}

function AttributeConfiguration({
  type,
  onClose,
}) {
  const qc = useQueryClient();

  const { data: allAttrs = [] } =
    useAttributes();

  const {
    data: mapped = [],
    isLoading,
  } = useCategoryAttributes(type?.id);

  const upsert = useUpsertCategoryAttribute();

  const [adding, setAdding] = useState(false);

  const mappedIds = new Set(
    mapped.map((item) => item.attributeId),
  );

  const availableAttrs = allAttrs.filter(
    (attr) => !mappedIds.has(attr.id),
  );

  const toggleAttribute = async (attribute) => {
    try {
      if (mappedIds.has(attribute.id)) {
        const existing = mapped.find(
          (item) =>
            item.attributeId === attribute.id,
        );

        if (existing) {
          await categoryAttributeRepo.remove(
            existing.id,
          );
        }

        toast.success(
          `${attribute.name} removed`,
        );
      } else {
        await upsert.mutateAsync({
          categoryId: type.id,
          attributeId: attribute.id,
          isRequired: false,
          sortOrder: mapped.length,
        });

        toast.success(
          `${attribute.name} added`,
        );
      }

      qc.invalidateQueries({
        queryKey: ["categoryAttributes", type.id],
      });
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to update attribute",
      );
    }
  };

  const setRequired = async (
    mapping,
    required,
  ) => {
    try {
      await upsert.mutateAsync({
        categoryId: type.id,
        attributeId: mapping.attributeId,
        isRequired: required,
        sortOrder: mapping.sortOrder ?? 0,
      });
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to update requirement",
      );
    }
  };

  return (
    <Sheet
      open={!!type}
      onClose={onClose}
      title={type ? `${type.name} configuration` : ""}
      subtitle="Choose which attributes appear when creating products of this type."
      width="lg"
    >
      {!type ? null : (
        <div className="space-y-5">
          {/* Summary */}
          <div className="rounded-2xl bg-bg border border-line p-4">
            <div className="text-xs font-semibold text-ink">
              Product type
            </div>

            <div className="flex items-center gap-3 mt-3">
              <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 flex items-center justify-center text-xs font-bold">
                {type.name
                  ?.slice(0, 2)
                  .toUpperCase()}
              </div>

              <div>
                <div className="text-sm font-bold text-ink">
                  {type.name}
                </div>

                <div className="text-[11px] text-muted">
                  {type.code}
                </div>
              </div>
            </div>
          </div>

          {/* Enabled */}
          <div>
            <div className="flex items-end justify-between gap-3 mb-2">
              <div>
                <div className="text-sm font-semibold text-ink">
                  Product attributes
                </div>

                <div className="text-xs text-muted mt-0.5">
                  {mapped.length} configured
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => setAdding(true)}
                disabled={!availableAttrs.length}
              >
                <Plus className="h-3.5 w-3.5" />
                Add attribute
              </Button>
            </div>

            {isLoading ? (
              <div className="rounded-xl border border-line p-5 text-sm text-muted">
                Loading configuration…
              </div>
            ) : mapped.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center">
                <Settings2 className="h-5 w-5 text-muted mx-auto" />

                <div className="text-sm font-semibold text-ink mt-3">
                  No attributes configured
                </div>

                <div className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  Add attributes such as Brand,
                  Thickness, Length or Grade.
                </div>

                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setAdding(true)}
                  disabled={!availableAttrs.length}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add first attribute
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {mapped
                  .slice()
                  .sort(
                    (a, b) =>
                      (a.sortOrder ?? 0) -
                      (b.sortOrder ?? 0),
                  )
                  .map((mapping) => {
                    const attr =
                      allAttrs.find(
                        (item) =>
                          item.id ===
                          mapping.attributeId,
                      );

                    if (!attr) return null;

                    return (
                      <div
                        key={mapping.id}
                        className="
                          rounded-xl
                          border
                          border-line
                          bg-surface
                          p-3.5
                          flex
                          items-center
                          gap-3
                        "
                      >
                        <div className="h-9 w-9 rounded-lg bg-bg border border-line flex items-center justify-center text-xs font-bold text-muted">
                          {attr.name
                            ?.slice(0, 1)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-ink">
                            {attr.name}
                          </div>

                          <div className="text-[10px] text-muted capitalize mt-0.5">
                            {attr.dataType}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-[11px] font-medium text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              mapping.isRequired ??
                              false
                            }
                            onChange={(event) =>
                              setRequired(
                                mapping,
                                event.target
                                  .checked,
                              )
                            }
                            className="accent-primary-500"
                          />

                          Required
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            toggleAttribute(attr)
                          }
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Add attributes */}
          <Sheet
            open={adding}
            onClose={() => setAdding(false)}
            title="Add attributes"
            subtitle={`Available attributes for ${type.name}`}
            width="md"
          >
            <div className="space-y-2">
              {availableAttrs.length === 0 ? (
                <EmptyState
                  compact
                  title="All attributes are configured"
                  description="There are no additional attributes to add."
                />
              ) : (
                availableAttrs.map((attr) => (
                  <button
                    key={attr.id}
                    type="button"
                    onClick={async () => {
                      await toggleAttribute(
                        attr,
                      );
                    }}
                    className="
                      w-full
                      text-left
                      rounded-xl
                      border
                      border-line
                      bg-surface
                      px-4
                      py-3.5
                      flex
                      items-center
                      gap-3
                      hover:bg-bg
                      hover:border-primary-300
                      dark:hover:border-primary-800
                      transition-colors
                    "
                  >
                    <div className="h-9 w-9 rounded-lg bg-bg border border-line flex items-center justify-center text-xs font-bold text-muted">
                      {attr.name
                        ?.slice(0, 1)
                        .toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ink">
                        {attr.name}
                      </div>

                      <div className="text-[10px] text-muted capitalize mt-0.5">
                        {attr.dataType}
                      </div>
                    </div>

                    <Plus className="h-4 w-4 text-primary-500" />
                  </button>
                ))
              )}
            </div>
          </Sheet>
        </div>
      )}
    </Sheet>
  );
}