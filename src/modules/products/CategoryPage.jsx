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
import { categorySchema } from "@/lib/domain/schemas";
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useAttributes, useCategoryAttributes, useUpsertCategoryAttribute,
} from "@/hooks/useMasters";
import { categoryAttributeRepo } from "@/lib/api/repos";
import { useQueryClient } from "@tanstack/react-query";
import { MODULE_TABS } from "@/app/moduleNav";

export function CategoryPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const { data: categories = [], isLoading } = useCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const selected = categories.find((c) => c.id === selectedId) || categories[0];

  const form = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", code: "", description: "", isActive: true },
  });

  const openNew = () => { setEdit("new"); form.reset({ name: "", code: "", description: "", isActive: true }); };
  const openEdit = (c) => { setEdit(c); form.reset(c); };

  const onSubmit = async (values) => {
    try {
      if (edit === "new") {
        const created = await createCat.mutateAsync(values);
        toast.success("Category created");
        setSelectedId(created.id);
      } else {
        await updateCat.mutateAsync({ id: edit.id, patch: values });
        toast.success("Category updated");
      }
      setEdit(null);
    } catch (e) { toast.error(e?.message || "Failed"); }
  };

  const onDelete = async () => {
    await deleteCat.mutateAsync(confirm.id);
    toast.success("Category deleted");
    setConfirm(null);
    setSelectedId(null);
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products and control which attributes apply"
        actions={
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Category</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.products} />

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0 md:gap-4 p-3 md:p-6">
        <Card className="md:sticky md:top-4 h-fit">
          <div className="px-3 py-2 border-b border-line text-xs font-bold text-timber-700 uppercase tracking-wide">
            Categories ({categories.length})
          </div>
          <div className="max-h-[60vh] md:max-h-[70vh] overflow-y-auto scrollbar-thin divide-y divide-line">
            {isLoading ? (
              <div className="p-4 text-sm text-muted">Loading…</div>
            ) : categories.length === 0 ? (
              <div className="p-4 text-sm text-muted">No categories yet.</div>
            ) : (
              categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors",
                    selected?.id === c.id
                      ? "bg-timber-100 border-l-2 border-timber-500"
                      : "hover:bg-timber-50 border-l-2 border-transparent",
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-timber-700 truncate">
                      {c.name}
                    </div>
                    <div className="text-[11px] text-muted">{c.code}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      className="p-1 text-[10px] font-semibold text-timber-700 hover:bg-timber-200 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirm(c); }}
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

        <div>
          {selected ? (
            <CategoryAttributesPanel category={selected} />
          ) : (
            <Card>
              <EmptyState
                title="Select a category"
                description="Pick a category to choose which attributes apply to its products."
              />
            </Card>
          )}
        </div>
      </div>

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit === "new" ? "New Category" : "Edit Category"}
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
              <Input {...form.register("name")} placeholder="e.g. Plywood" />
            </Field>
            <Field label="Code" required error={form.formState.errors.code?.message}>
              <Input {...form.register("code")} placeholder="e.g. PLYWOOD" />
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
        title="Delete category?"
        description={`"${confirm?.name}" will be removed. Products in this category may break.`}
        confirmLabel="Delete"
      />
    </>
  );
}

function CategoryAttributesPanel({ category }) {
  const qc = useQueryClient();
  const { data: allAttrs = [] } = useAttributes();
  const { data: mapped = [], isLoading } = useCategoryAttributes(category.id);
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
          categoryId: category.id,
          attributeId: attr.id,
          isRequired: attr.isRequired,
          sortOrder: mapped.length,
        });
        toast.success(`${attr.name} added`);
      }
      qc.invalidateQueries({ queryKey: ["categoryAttributes", category.id] });
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  const setRequired = async (attr, isRequired) => {
    const existing = mapped.find((m) => m.attributeId === attr.id);
    if (!existing) return;
    await upsert.mutateAsync({
      categoryId: category.id,
      attributeId: attr.id,
      isRequired,
      sortOrder: existing.sortOrder,
    });
    qc.invalidateQueries({ queryKey: ["categoryAttributes", category.id] });
  };

  return (
    <Card>
      <div className="px-4 py-3 border-b border-line">
        <div className="font-semibold text-timber-700 text-sm">
          Attributes for {category.name}
        </div>
        <div className="text-xs text-muted mt-0.5">
          Tick attributes that should appear when creating a product in this category.
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 text-sm text-muted">Loading…</div>
      ) : (
        <div className="divide-y divide-line">
          {allAttrs.map((a) => {
            const isMapped = mappedIds.has(a.id);
            const mapping = mapped.find((m) => m.attributeId === a.id);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 transition-colors",
                  isMapped && "bg-timber-50/50",
                )}
              >
                <button
                  onClick={() => toggle(a)}
                  className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                    isMapped
                      ? "bg-timber-500 border-timber-500 text-white"
                      : "bg-white border-timber-400",
                  )}
                >
                  {isMapped && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-timber-700 truncate">
                    {a.name}
                  </div>
                  <div className="text-[11px] text-muted capitalize">
                    {a.dataType}
                  </div>
                </div>
                {isMapped && (
                  <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mapping?.isRequired ?? false}
                      onChange={(e) => setRequired(a, e.target.checked)}
                      className="accent-timber-500"
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