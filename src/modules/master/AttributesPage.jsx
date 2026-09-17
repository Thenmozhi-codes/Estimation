import { useMemo, useState } from "react";
import {
  Plus,
  Settings2,
  Trash2,
  Tag,
  Hash,
  Type,
  ToggleLeft,
} from "lucide-react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Sheet } from "@/components/ui/Sheet";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { toast } from "@/lib/toast";

import {
  attributeSchema,
  attributeValueSchema,
} from "@/lib/domain/schemas/master";

import { DATA_TYPE_OPTIONS } from "@/lib/domain/options";

import {
  useAttributes,
  useCreateAttribute,
  useUpdateAttribute,
  useDeleteAttribute,
  useAttributeValues,
  useCreateAttributeValue,
  useUpdateAttributeValue,
  useDeleteAttributeValue,
} from "@/hooks/useMasters";

import { MODULE_TABS } from "@/app/moduleNav";

const TYPE_META = {
  select: {
    label: "Select",
    icon: Tag,
  },
  number: {
    label: "Number",
    icon: Hash,
  },
  text: {
    label: "Text",
    icon: Type,
  },
  boolean: {
    label: "Yes / No",
    icon: ToggleLeft,
  },
};

export function AttributesPage() {
  const [search, setSearch] = useState("");
  const [editAttr, setEditAttr] = useState(null);
  const [manageAttr, setManageAttr] = useState(null);
  const [confirmAttr, setConfirmAttr] = useState(null);

  const {
    data: attributes = [],
    isLoading,
  } = useAttributes();

  const createAttr = useCreateAttribute();
  const updateAttr = useUpdateAttribute();
  const deleteAttr = useDeleteAttribute();

  const form = useForm({
    resolver: zodResolver(attributeSchema),
    defaultValues: {
      name: "",
      code: "",
      dataType: "select",
      isRequired: false,
      isActive: true,
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return attributes;

    return attributes.filter(
      (attribute) =>
        attribute.name
          ?.toLowerCase()
          .includes(q) ||
        attribute.code
          ?.toLowerCase()
          .includes(q) ||
        attribute.dataType
          ?.toLowerCase()
          .includes(q),
    );
  }, [attributes, search]);

  const openCreate = () => {
    setEditAttr("new");

    form.reset({
      name: "",
      code: "",
      dataType: "select",
      isRequired: false,
      isActive: true,
    });
  };

  const openEdit = (attribute) => {
    setEditAttr(attribute);

    form.reset({
      name: attribute.name || "",
      code: attribute.code || "",
      dataType:
        attribute.dataType || "select",
      isRequired:
        attribute.isRequired ?? false,
      isActive:
        attribute.isActive ?? true,
    });
  };

  const submit = async (values) => {
    try {
      if (editAttr === "new") {
        const created =
          await createAttr.mutateAsync(values);

        toast.success("Attribute created");

        setEditAttr(null);
        setManageAttr(created);
      } else {
        await updateAttr.mutateAsync({
          id: editAttr.id,
          patch: values,
        });

        toast.success("Attribute updated");

        setEditAttr(null);
      }
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to save attribute",
      );
    }
  };

  const deleteAttribute = async () => {
    try {
      await deleteAttr.mutateAsync(
        confirmAttr.id,
      );

      toast.success("Attribute deleted");

      setConfirmAttr(null);

      if (
        manageAttr?.id === confirmAttr.id
      ) {
        setManageAttr(null);
      }
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to delete attribute",
      );
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Attributes"
        description="Create reusable product fields such as Brand, Thickness, Length and Grade."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Attribute
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-24 md:pb-8">
        {/* Search */}
        <div className="mb-5">
          <div className="relative max-w-md">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search attributes…"
              className="
                w-full
                h-10
                px-3.5
                rounded-xl
                bg-surface
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
        </div>

        {/* Attributes */}
        {isLoading ? (
          <Card>
            <CardBody className="p-8 text-sm text-muted">
              Loading attributes…
            </CardBody>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              title={
                search
                  ? "No matching attributes"
                  : "No attributes yet"
              }
              description={
                search
                  ? "Try a different search term."
                  : "Create reusable fields for your products."
              }
              action={
                !search && (
                  <Button
                    size="sm"
                    onClick={openCreate}
                  >
                    <Plus className="h-4 w-4" />
                    Create attribute
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((attribute) => (
              <AttributeCard
                key={attribute.id}
                attribute={attribute}
                onManage={() =>
                  setManageAttr(attribute)
                }
                onEdit={() =>
                  openEdit(attribute)
                }
                onDelete={() =>
                  setConfirmAttr(attribute)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Attribute editor */}
      <Sheet
        open={!!editAttr}
        onClose={() => setEditAttr(null)}
        title={
          editAttr === "new"
            ? "Create attribute"
            : "Edit attribute"
        }
        subtitle="Define the field once and reuse it across product types."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setEditAttr(null)}
            >
              Cancel
            </Button>

            <Button
              onClick={form.handleSubmit(submit)}
              loading={
                createAttr.isPending ||
                updateAttr.isPending
              }
            >
              {editAttr === "new"
                ? "Create attribute"
                : "Save changes"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={form.handleSubmit(submit)}
          className="space-y-5"
        >
          <Field
            label="Attribute name"
            required
            error={
              form.formState.errors.name?.message
            }
          >
            <Input
              {...form.register("name")}
              placeholder="e.g. Thickness"
            />
          </Field>

          <Field
            label="Code"
            required
            hint="Internal identifier. Example: THICKNESS."
            error={
              form.formState.errors.code?.message
            }
          >
            <Input
              {...form.register("code")}
              placeholder="THICKNESS"
            />
          </Field>

          <Field
            label="Field type"
            required
          >
            <Select
              {...form.register("dataType")}
            >
              {DATA_TYPE_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </Select>
          </Field>

          <div className="rounded-xl border border-line bg-bg p-4">
            <div className="text-xs font-semibold text-ink">
              Product behavior
            </div>

            <div className="flex items-center justify-between gap-4 mt-4">
              <div>
                <div className="text-xs font-medium text-ink">
                  Required
                </div>

                <div className="text-[11px] text-muted mt-0.5">
                  The value must be provided when
                  creating a product.
                </div>
              </div>

              <Switch
                checked={form.watch(
                  "isRequired",
                )}
                onChange={(value) =>
                  form.setValue(
                    "isRequired",
                    value,
                  )
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-line">
              <div>
                <div className="text-xs font-medium text-ink">
                  Active
                </div>

                <div className="text-[11px] text-muted mt-0.5">
                  Keep this attribute available
                  for future products.
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
          </div>
        </form>
      </Sheet>

      {/* Values drawer */}
      <AttributeValuesDrawer
        attribute={manageAttr}
        onClose={() => setManageAttr(null)}
      />

      <ConfirmDialog
        open={!!confirmAttr}
        onClose={() => setConfirmAttr(null)}
        onConfirm={deleteAttribute}
        title="Delete attribute?"
        description={`"${confirmAttr?.name}" will be removed from the master. Existing product data may reference this attribute.`}
        confirmLabel="Delete"
        loading={deleteAttr.isPending}
      />
    </div>
  );
}

function AttributeCard({
  attribute,
  onManage,
  onEdit,
  onDelete,
}) {
  const meta =
    TYPE_META[attribute.dataType] ||
    TYPE_META.text;

  const Icon = meta.icon;

  const {
    data: values = [],
  } = useAttributeValues(
    attribute.dataType === "select"
      ? attribute.id
      : undefined,
  );

  return (
    <Card interactive className="group">
      <CardBody>
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 flex items-center justify-center shrink-0">
            <Icon className="h-4.5 w-4.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-ink truncate">
                  {attribute.name}
                </div>

                <div className="text-[10px] text-muted mt-0.5">
                  {attribute.code}
                </div>
              </div>

              {attribute.isRequired && (
                <span className="shrink-0 px-2 py-1 rounded-md bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 text-[10px] font-semibold">
                  Required
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] px-2 py-1 rounded-md bg-bg border border-line text-muted">
                {meta.label}
              </span>

              {attribute.dataType ===
                "select" && (
                <span className="text-[10px] text-muted">
                  {values.length} values
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-line">
              {attribute.dataType ===
                "select" && (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={onManage}
                >
                  <Settings2 className="h-3 w-3" />
                  Manage values
                </Button>
              )}

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
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function AttributeValuesDrawer({
  attribute,
  onClose,
}) {
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const {
    data: values = [],
    isLoading,
  } = useAttributeValues(attribute?.id);

  const createValue =
    useCreateAttributeValue();

  const updateValue =
    useUpdateAttributeValue();

  const deleteValue =
    useDeleteAttributeValue();

  const form = useForm({
    resolver: zodResolver(
      attributeValueSchema,
    ),
    defaultValues: {
      attributeId: "",
      label: "",
      code: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  const openCreate = () => {
    form.reset({
      attributeId: attribute.id,
      label: "",
      code: "",
      sortOrder: values.length,
      isActive: true,
    });

    setEdit("new");
  };

  const openEdit = (value) => {
    form.reset({
      attributeId: attribute.id,
      label: value.label || "",
      code: value.code || "",
      sortOrder: value.sortOrder ?? 0,
      isActive: value.isActive ?? true,
    });

    setEdit(value);
  };

  const submit = async (data) => {
    try {
      if (edit === "new") {
        await createValue.mutateAsync({
          ...data,
          attributeId: attribute.id,
        });

        toast.success("Value added");
      } else {
        await updateValue.mutateAsync({
          id: edit.id,
          patch: data,
          attributeId: attribute.id,
        });

        toast.success("Value updated");
      }

      setEdit(null);
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to save value",
      );
    }
  };

  const deleteItem = async () => {
    try {
      await deleteValue.mutateAsync({
        id: confirm.id,
        attributeId: attribute.id,
      });

      toast.success("Value removed");
      setConfirm(null);
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to delete value",
      );
    }
  };

  return (
    <Sheet
      open={!!attribute}
      onClose={onClose}
      title={
        attribute
          ? `${attribute.name} values`
          : ""
      }
      subtitle={
        attribute
          ? `${values.length} values configured`
          : ""
      }
      width="lg"
    >
      {!attribute ? null : (
        <div className="space-y-5">
          <div className="rounded-xl bg-bg border border-line p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-ink">
                Value list
              </div>

              <div className="text-[11px] text-muted mt-0.5">
                These values become selectable when
                this attribute is used.
              </div>
            </div>

            <Button
              size="sm"
              onClick={openCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              Add value
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted p-5">
              Loading values…
            </div>
          ) : values.length === 0 ? (
            <EmptyState
              compact
              title="No values yet"
              description="Add values such as 12mm, 18mm, MR or BWP."
              action={
                <Button
                  size="sm"
                  onClick={openCreate}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add first value
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {values
                .slice()
                .sort(
                  (a, b) =>
                    (a.sortOrder ?? 0) -
                    (b.sortOrder ?? 0),
                )
                .map((value) => (
                  <div
                    key={value.id}
                    className="
                      rounded-xl
                      border
                      border-line
                      p-3.5
                      flex
                      items-center
                      gap-3
                    "
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-600 flex items-center justify-center text-xs font-bold">
                      {value.label
                        ?.slice(0, 1)
                        .toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ink truncate">
                        {value.label}
                      </div>

                      <div className="text-[10px] text-muted mt-0.5">
                        {value.code}
                      </div>
                    </div>

                    <div className="hidden sm:block text-[10px] text-muted">
                      #{value.sortOrder ?? 0}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openEdit(value)
                      }
                      className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-muted hover:text-ink hover:bg-bg"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirm(value)
                      }
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-danger/70 hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          )}

          <Sheet
            open={!!edit}
            onClose={() => setEdit(null)}
            title={
              edit === "new"
                ? `Add value`
                : "Edit value"
            }
            subtitle={
              attribute
                ? `Value for ${attribute.name}`
                : ""
            }
            width="sm"
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setEdit(null)}
                >
                  Cancel
                </Button>

                <Button
                  onClick={form.handleSubmit(
                    submit,
                  )}
                  loading={
                    createValue.isPending ||
                    updateValue.isPending
                  }
                >
                  {edit === "new"
                    ? "Add value"
                    : "Save changes"}
                </Button>
              </>
            }
          >
            <form
              onSubmit={form.handleSubmit(
                submit,
              )}
              className="space-y-5"
            >
              <Field
                label="Value"
                required
                error={
                  form.formState.errors
                    .label?.message
                }
              >
                <Input
                  {...form.register("label")}
                  placeholder="e.g. 18mm"
                />
              </Field>

              <Field
                label="Code"
                required
                hint="Example: 18MM"
                error={
                  form.formState.errors
                    .code?.message
                }
              >
                <Input
                  {...form.register("code")}
                  placeholder="18MM"
                />
              </Field>

              <Field label="Sort order">
                <Input
                  type="number"
                  {...form.register(
                    "sortOrder",
                  )}
                />
              </Field>
            </form>
          </Sheet>

          <ConfirmDialog
            open={!!confirm}
            onClose={() => setConfirm(null)}
            onConfirm={deleteItem}
            title="Delete value?"
            description={`"${confirm?.label}" will be removed.`}
            confirmLabel="Delete"
            loading={
              deleteValue.isPending
            }
          />
        </div>
      )}
    </Sheet>
  );
}