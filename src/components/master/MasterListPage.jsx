import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Sheet } from "@/components/ui/Sheet";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormGrid } from "@/components/ui/FormGrid";
import { toast } from "@/lib/toast";

/**
 * config = {
 *   title, description, moduleKey, tabs,
 *   schema,
 *   defaultValues,
 *   columns: [{ key, header, render?, sortable?, align? }],
 *   fields: [{ name, label, type, required?, options?, hint?, colSpan?, placeholder? }],
 *   useList, useCreate, useUpdate, useDelete,
 *   toFormValues,   // (row) -> form default values (optional)
 *   searchKeys,     // array of keys used for search filter
 *   entityLabel,    // "Brand", "Unit"...
 * }
 */
export function MasterListPage({ config }) {
  const {
    title, description, moduleKey, tabs,
    schema, defaultValues, columns, fields,
    useList, useCreate, useUpdate, useDelete,
    toFormValues, searchKeys = ["name"], entityLabel = "Item",
  } = config;

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const listQuery = useList();
  const createMut = useCreate();
  const updateMut = useUpdate();
  const deleteMut = useDelete();

  const rows = listQuery.data || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      searchKeys.some((k) =>
        String(r[k] ?? "").toLowerCase().includes(q),
      ),
    );
  }, [rows, search, searchKeys]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(defaultValues);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    form.reset(toFormValues ? toFormValues(row) : row);
    setOpen(true);
  };

  const onSubmit = async (values) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, patch: values });
        toast.success(`${entityLabel} updated`);
      } else {
        await createMut.mutateAsync(values);
        toast.success(`${entityLabel} created`);
      }
      setOpen(false);
    } catch (e) {
      toast.error(e?.message || "Something went wrong");
    }
  };

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(confirm.id);
      toast.success(`${entityLabel} deleted`);
      setConfirm(null);
    } catch (e) {
      toast.error(e?.message || "Delete failed");
    }
  };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New {entityLabel}</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      {moduleKey && <ModuleTabs tabs={tabs} />}
      <Toolbar search={search} onSearch={setSearch} placeholder={`Search ${entityLabel.toLowerCase()}…`} />

      <div className="bg-white border-t border-line">
        <DataTable
          columns={[
            ...columns,
            {
              key: "__actions",
              header: "",
              width: 80,
              align: "right",
              render: (row) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                    className="px-2 py-1 text-xs font-semibold text-timber-700 hover:bg-timber-100 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirm(row); }}
                    className="px-2 py-1 text-xs font-semibold text-danger hover:bg-red-50 rounded"
                  >
                    Del
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
          loading={listQuery.isLoading}
          emptyTitle={`No ${entityLabel.toLowerCase()} yet`}
          emptyDescription={`Create your first ${entityLabel.toLowerCase()} to get started.`}
          emptyAction={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New {entityLabel}
            </Button>
          }
        />
      </div>

      {/* Form sheet */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${entityLabel}` : `New ${entityLabel}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Save changes" : `Create ${entityLabel}`}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormGrid cols={2}>
            {fields.map((f) => (
              <Field
                key={f.name}
                label={f.label}
                required={f.required}
                error={form.formState.errors[f.name]?.message}
                hint={f.hint}
                className={f.colSpan === 2 ? "sm:col-span-2" : ""}
              >
                <FieldRenderer field={f} form={form} />
              </Field>
            ))}
          </FormGrid>
        </form>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title={`Delete ${entityLabel.toLowerCase()}?`}
        description={`"${confirm?.name}" will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </>
  );
}

function FieldRenderer({ field, form }) {
  const { register, control } = form;

  switch (field.type) {
    case "textarea":
      return <Textarea {...register(field.name)} placeholder={field.placeholder} />;
    case "select":
      return (
        <Select {...register(field.name)}>
          <option value="">Select…</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      );
    case "number":
      return <Input type="number" step="any" {...register(field.name)} placeholder={field.placeholder} />;
    case "switch":
      return (
        <Controller
          control={control}
          name={field.name}
          render={({ field: f }) => (
            <div className="flex items-center h-9">
              <Switch checked={!!f.value} onChange={f.onChange} label={field.switchLabel || "Enabled"} />
            </div>
          )}
        />
      );
    default:
      return <Input {...register(field.name)} placeholder={field.placeholder} />;
  }
}