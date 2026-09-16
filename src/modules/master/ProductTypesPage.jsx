import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormGrid } from "@/components/ui/FormGrid";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";
import { categorySchema } from "@/lib/domain/schemas/master";
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useAttributes, useCategoryAttributes, useUpsertCategoryAttribute,
} from "@/hooks/useMasters";
import { categoryAttributeRepo } from "@/lib/api/repos";
import { useQueryClient } from "@tanstack/react-query";
import { MODULE_TABS } from "@/app/moduleNav";

export function ProductTypesPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const { data: types = [], isLoading } = useCategories();
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();

  const selected = types.find((t) => t.id === selectedId) || types[0];

  const form = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", code: "", description: "", isActive: true },
  });

  const openNew = () => {
    setEdit("new");
    form.reset({ name: "", code: "", description: "", isActive: true });
  };
  const openEdit = (t) => { setEdit(t); form.reset(t); };

  const onSubmit = async (values) => {
    try {
      if (edit === "new") {
        const created = await createMut.mutateAsync(values);
        toast.success("Product type created");
        setSelectedId(created.id);
      } else {
        await updateMut.mutateAsync({ id: edit.id, patch: values });
        toast.success("Product type updated");
      }
      setEdit(null);
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  const onDelete = async () => {
    await deleteMut.mutateAsync(confirm.id);
    toast.success("Product type deleted");
    setConfirm(null);
    setSelectedId(null);
  };

  return (
    <>
      <PageHeader
        title="Product Types"
        description="Types of products you sell — each drives its own set of attributes"
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Type</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0 md:gap-4 p-3 md:p-5">
        <Card className="md:sticky md:top-4 h-fit">
          <div className="px-3 py-2 border-b border-line text-2xs font-bold text-muted uppercase tracking-wider">
            Types ({types.length})
          </div>
          <div className="max-h-[60vh] md:max-h-[70vh] overflow-y-auto scrollbar-thin divide-y divide-line">
            {isLoading ? (
              <div className="p-4 text-sm text-muted">Loading…</div>
            ) : types.length === 0 ? (
              <div className="p-4 text-sm text-muted">No types yet.</div>
            ) : (
              types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors",
                    selected?.id === t.id
                      ? "bg-primary-50 dark:bg-primary-950/30 border-l-2 border-primary-500"
                      : "hover:bg-bg border-l-2 border-transparent",
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">
                      {t.name}
                    </div>
                    <div className="text-2xs text-muted">{t.code}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                      className="px-1.5 py-1 text-2xs font-semibold text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-950/40 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirm(t); }}
                      className="p-1 text-danger hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <div>
          {selected ? (
            <AttributesMappingPanel type={selected} />
          ) : (
            <Card>
              <EmptyState
                title="Select a product type"
                description="Pick a type to choose which attributes apply to its products."
              />
            </Card>
          )}
        </div>
      </div>

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit === "new" ? "New Product Type" : "Edit Product Type"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)}>
              {edit === "new" ? "Create" : "Save"}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormGrid cols={2}>
            <Field label="Name" required error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder="e.g. Ply" />
            </Field>
            <Field label="Code" required error={form.formState.errors.code?.message}>
              <Input {...form.register("code")} placeholder="e.g. PLY" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea {...form.register("description")} rows={2} placeholder="Optional" />
            </Field>
          </FormGrid>
        </form>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete product type?"
        description={`"${confirm?.name}" will be removed. Products using this type may break.`}
        confirmLabel="Delete"
      />
    </>
  );
}

function AttributesMappingPanel({ type }) {
  const qc = useQueryClient();
  const { data: allAttrs = [] } = useAttributes();
  const { data: mapped = [], isLoading } = useCategoryAttributes(type.id);
  const upsert = useUpsertCategoryAttribute();

  const mappedIds = new Set(mapped.map((m) => m.attributeId));

  const toggle = async (attr) => {
    try {
      if (mappedIds.has(attr.id)) {
        const existing = mapped.find((m) => m.attributeId === attr.id);
        await categoryAttributeRepo.remove(existing.id);
        toast.success(`${attr.name} removed`);
      } else {
        await upsert.mutateAsync({
          categoryId: type.id,
          attributeId: attr.id,
          isRequired: attr.isRequired,
          sortOrder: mapped.length,
        });
        toast.success(`${attr.name} added`);
      }
      qc.invalidateQueries({ queryKey: ["categoryAttributes", type.id] });
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  const setRequired = async (attr, isRequired) => {
    const existing = mapped.find((m) => m.attributeId === attr.id);
    if (!existing) return;
    await upsert.mutateAsync({
      categoryId: type.id,
      attributeId: attr.id,
      isRequired,
      sortOrder: existing.sortOrder,
    });
    qc.invalidateQueries({ queryKey: ["categoryAttributes", type.id] });
  };

  return (
    <Card>
      <div className="px-5 py-3.5 border-b border-line">
        <div className="font-semibold text-ink text-sm">
          Attributes for {type.name}
        </div>
        <div className="text-2xs text-muted mt-0.5">
          Tick attributes that should appear when creating a product of this type.
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 text-sm text-muted">Loading…</div>
      ) : allAttrs.length === 0 ? (
        <EmptyState
          compact
          title="No attributes defined"
          description="Create attributes first from Master → Attributes."
        />
      ) : (
        <div className="divide-y divide-line">
          {allAttrs.map((a) => {
            const isMapped = mappedIds.has(a.id);
            const mapping = mapped.find((m) => m.attributeId === a.id);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-2.5 transition-colors",
                  isMapped && "bg-primary-50/40 dark:bg-primary-950/20",
                )}
              >
                <button
                  onClick={() => toggle(a)}
                  className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                    isMapped
                      ? "bg-primary-500 border-primary-500 text-white"
                      : "bg-surface border-line hover:border-primary-400",
                  )}
                >
                  {isMapped && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink truncate">
                    {a.name}
                  </div>
                  <div className="text-2xs text-muted capitalize">
                    {a.dataType}
                  </div>
                </div>
                {isMapped && (
                  <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mapping?.isRequired ?? false}
                      onChange={(e) => setRequired(a, e.target.checked)}
                      className="accent-primary-500"
                    />
                    Required
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}