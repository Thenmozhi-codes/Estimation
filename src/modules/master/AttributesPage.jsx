import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormGrid } from "@/components/ui/FormGrid";
import { DataTable } from "@/components/ui/DataTable";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";
import { attributeSchema, attributeValueSchema } from "@/lib/domain/schemas";
import { DATA_TYPE_OPTIONS } from "@/lib/domain/options";
import {
  useAttributes, useCreateAttribute, useUpdateAttribute, useDeleteAttribute,
  useAttributeValues, useCreateAttributeValue, useUpdateAttributeValue, useDeleteAttributeValue,
} from "@/hooks/useMasters";
import { MODULE_TABS } from "@/app/moduleNav";

export function AttributesPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [editAttr, setEditAttr] = useState(null); // null | "new" | row
  const [confirmAttr, setConfirmAttr] = useState(null);

  const { data: attributes = [], isLoading } = useAttributes();
  const createAttr = useCreateAttribute();
  const updateAttr = useUpdateAttribute();
  const deleteAttr = useDeleteAttribute();

  const selected = attributes.find((a) => a.id === selectedId) || attributes[0];

  const attrForm = useForm({
    resolver: zodResolver(attributeSchema),
    defaultValues: { name: "", code: "", dataType: "select", isRequired: false, isActive: true },
  });

  const openNew = () => {
    setEditAttr("new");
    attrForm.reset({ name: "", code: "", dataType: "select", isRequired: false, isActive: true });
  };
  const openEdit = (a) => {
    setEditAttr(a);
    attrForm.reset(a);
  };
  const onSubmitAttr = async (values) => {
    try {
      if (editAttr === "new") {
        const created = await createAttr.mutateAsync(values);
        toast.success("Attribute created");
        setSelectedId(created.id);
      } else {
        await updateAttr.mutateAsync({ id: editAttr.id, patch: values });
        toast.success("Attribute updated");
      }
      setEditAttr(null);
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  const onDeleteAttr = async () => {
    await deleteAttr.mutateAsync(confirmAttr.id);
    toast.success("Attribute deleted");
    setConfirmAttr(null);
    setSelectedId(null);
  };

  return (
    <>
      <PageHeader
        title="Attributes"
        description="Define what fields each product can have"
        actions={
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Attribute</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0 md:gap-4 p-3 md:p-6">
        {/* Left: attributes list */}
        <Card className="md:sticky md:top-4 h-fit">
          <div className="px-3 py-2 border-b border-line text-xs font-bold text-timber-700 uppercase tracking-wide">
            Attributes ({attributes.length})
          </div>
          <div className="max-h-[60vh] md:max-h-[70vh] overflow-y-auto scrollbar-thin divide-y divide-line">
            {isLoading ? (
              <div className="p-4 text-sm text-muted">Loading…</div>
            ) : attributes.length === 0 ? (
              <div className="p-4 text-sm text-muted">No attributes yet.</div>
            ) : (
              attributes.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors",
                    selected?.id === a.id
                      ? "bg-timber-100 border-l-2 border-timber-500"
                      : "hover:bg-timber-50 border-l-2 border-transparent",
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-timber-700 truncate">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-muted capitalize">
                      {a.dataType}
                      {a.isRequired ? " · required" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                      className="p-1 text-[10px] font-semibold text-timber-700 hover:bg-timber-200 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmAttr(a); }}
                      className="p-1 text-danger hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Right: values for selected attribute */}
        <div>
          {selected ? (
            <AttributeValuesPanel attribute={selected} />
          ) : (
            <Card>
              <EmptyState
                title="Select an attribute"
                description="Pick an attribute from the left to manage its values."
              />
            </Card>
          )}
        </div>
      </div>

      {/* Attribute form */}
      <Sheet
        open={!!editAttr}
        onClose={() => setEditAttr(null)}
        title={editAttr === "new" ? "New Attribute" : "Edit Attribute"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditAttr(null)}>Cancel</Button>
            <Button onClick={attrForm.handleSubmit(onSubmitAttr)}>
              {editAttr === "new" ? "Create" : "Save"}
            </Button>
          </>
        }
      >
        <form onSubmit={attrForm.handleSubmit(onSubmitAttr)} className="space-y-4">
          <FormGrid cols={2}>
            <Field label="Name" required error={attrForm.formState.errors.name?.message}>
              <Input {...attrForm.register("name")} placeholder="e.g. Thickness" />
            </Field>
            <Field label="Code" required error={attrForm.formState.errors.code?.message}>
              <Input {...attrForm.register("code")} placeholder="e.g. THICKNESS" />
            </Field>
            <Field label="Data type" required>
              <Select {...attrForm.register("dataType")}>
                {DATA_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Required?">
              <div className="flex items-center h-9">
                <Switch
                  checked={attrForm.watch("isRequired")}
                  onChange={(v) => attrForm.setValue("isRequired", v)}
                  label="Required on every product"
                />
              </div>
            </Field>
            <Field label="Status" className="sm:col-span-2">
              <div className="flex items-center h-9">
                <Switch
                  checked={attrForm.watch("isActive")}
                  onChange={(v) => attrForm.setValue("isActive", v)}
                  label="Active"
                />
              </div>
            </Field>
          </FormGrid>
        </form>
      </Sheet>

      <ConfirmDialog
        open={!!confirmAttr}
        onClose={() => setConfirmAttr(null)}
        onConfirm={onDeleteAttr}
        title="Delete attribute?"
        description={`"${confirmAttr?.name}" and its values will be removed.`}
        confirmLabel="Delete"
      />
    </>
  );
}

/* ---------- Attribute values panel ---------- */
function AttributeValuesPanel({ attribute }) {
  const { data: values = [], isLoading } = useAttributeValues(attribute.id);
  const createVal = useCreateAttributeValue();
  const updateVal = useUpdateAttributeValue();
  const deleteVal = useDeleteAttributeValue();

  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const isSelect = attribute.dataType === "select";

  const form = useForm({
    resolver: zodResolver(attributeValueSchema),
    defaultValues: { attributeId: attribute.id, label: "", code: "", sortOrder: 0, isActive: true },
  });

  const openNew = () => {
    setEdit("new");
    form.reset({
      attributeId: attribute.id,
      label: "",
      code: "",
      sortOrder: values.length,
      isActive: true,
    });
  };
  const openEdit = (v) => { setEdit(v); form.reset(v); };

  const onSubmit = async (d) => {
    try {
      if (edit === "new") {
        await createVal.mutateAsync({ ...d, attributeId: attribute.id });
        toast.success("Value added");
      } else {
        await updateVal.mutateAsync({ id: edit.id, patch: d, attributeId: attribute.id });
        toast.success("Value updated");
      }
      setEdit(null);
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  const onDelete = async () => {
    await deleteVal.mutateAsync({ id: confirm.id, attributeId: attribute.id });
    toast.success("Value removed");
    setConfirm(null);
  };

  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div>
          <div className="font-semibold text-timber-700 text-sm">
            {attribute.name}
            <span className="ml-2 text-xs font-normal text-muted capitalize">
              ({attribute.dataType})
            </span>
          </div>
          {!isSelect && (
            <div className="text-xs text-muted mt-0.5">
              This attribute is <b>{attribute.dataType}</b>. Free-form values are entered per product — no fixed list needed.
            </div>
          )}
        </div>
        {isSelect && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add value
          </Button>
        )}
      </div>

      {!isSelect ? (
        <div className="p-6">
          <EmptyState
            title="No value list required"
            description={`${attribute.dataType} attributes take their value directly when creating a product variant.`}
          />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: "label", header: "Value", sortable: true },
            { key: "code", header: "Code", sortable: true, hideOnMobile: true },
            {
              key: "sortOrder",
              header: "Order",
              align: "right",
              hideOnMobile: true,
              render: (r) => r.sortOrder ?? 0,
            },
            {
              key: "__actions",
              header: "",
              align: "right",
              width: 100,
              render: (row) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => openEdit(row)}
                    className="px-2 py-1 text-xs font-semibold text-timber-700 hover:bg-timber-100 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirm(row)}
                    className="px-2 py-1 text-xs font-semibold text-danger hover:bg-red-50 rounded"
                  >
                    Del
                  </button>
                </div>
              ),
            },
          ]}
          rows={values}
          loading={isLoading}
          emptyTitle="No values yet"
          emptyDescription="Add sizes, grades, colours — whatever this attribute can be."
          emptyAction={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add first value</Button>}
        />
      )}

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit === "new" ? `Add value to ${attribute.name}` : "Edit value"}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)}>
              {edit === "new" ? "Add" : "Save"}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Value" required error={form.formState.errors.label?.message}>
            <Input {...form.register("label")} placeholder="e.g. 18mm" />
          </Field>
          <Field label="Code" required error={form.formState.errors.code?.message}>
            <Input {...form.register("code")} placeholder="e.g. 18MM" />
          </Field>
          <Field label="Sort order">
            <Input type="number" {...form.register("sortOrder")} />
          </Field>
        </form>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete value?"
        description={`"${confirm?.label}" will be removed from ${attribute.name}.`}
        confirmLabel="Delete"
      />
    </Card>
  );
}