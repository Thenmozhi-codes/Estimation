import { useEffect, useMemo, useState } from "react";
import { Check, GripVertical, Plus, Search, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Sheet } from "@/components/ui/Sheet";

export default function ProductTypeConfigurator({
  open,
  onClose,
  productType,
  attributes = [],
  selectedAttributes = [],
  onSave,
  saving = false,
}) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;

    const source = selectedAttributes?.length
      ? selectedAttributes
      : [];

    setSelected(
      source
        .map((item, index) => ({
          id: item.id ?? item.attributeId,
          attributeId: item.attributeId ?? item.id,
          name: item.name,
          code: item.code,
          dataType: item.dataType,
          required: item.isRequired ?? item.required ?? false,
          sortOrder: item.sortOrder ?? index,
        }))
        .filter((item) => item.attributeId),
    );
    setSearch("");
  }, [open, selectedAttributes]);

  const selectedIds = useMemo(
    () => new Set(selected.map((item) => item.attributeId)),
    [selected],
  );

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attributes.filter((attribute) => {
      if (selectedIds.has(attribute.id)) return false;
      if (!q) return true;
      return `${attribute.name} ${attribute.code} ${attribute.dataType}`
        .toLowerCase()
        .includes(q);
    });
  }, [attributes, search, selectedIds]);

  const addAttribute = (attribute) => {
    setSelected((current) => [
      ...current,
      {
        id: attribute.id,
        attributeId: attribute.id,
        name: attribute.name,
        code: attribute.code,
        dataType: attribute.dataType,
        required: !!attribute.isRequired,
        sortOrder: current.length,
      },
    ]);
  };

  const removeAttribute = (attributeId) => {
    setSelected((current) =>
      current
        .filter((item) => item.attributeId !== attributeId)
        .map((item, index) => ({ ...item, sortOrder: index })),
    );
  };

  const toggleRequired = (attributeId) => {
    setSelected((current) =>
      current.map((item) =>
        item.attributeId === attributeId
          ? { ...item, required: !item.required }
          : item,
      ),
    );
  };

  const move = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selected.length) return;

    setSelected((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((item, i) => ({ ...item, sortOrder: i }));
    });
  };

  const handleSave = async () => {
    await onSave?.(
      selected.map((item, index) => ({
        ...item,
        attributeId: item.attributeId,
        required: !!item.required,
        sortOrder: index,
      })),
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="lg"
      title="Configure product type"
      subtitle={
        productType
          ? `${productType.name} · Define the fields used by this product type`
          : "Define the fields used by this product type"
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            <Check className="h-4 w-4" />
            Save configuration
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-primary-200/70 bg-primary-50/60 dark:border-primary-900/50 dark:bg-primary-950/20 p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
              <Settings2 className="h-5 w-5 text-primary-600 dark:text-primary-300" />
            </div>
            <div>
              <div className="text-sm font-bold text-ink">Product type fields</div>
              <p className="text-xs text-muted mt-1 leading-5">
                Choose which attributes should appear whenever a product uses this
                product type. The order below becomes the order shown in product variants.
              </p>
            </div>
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-sm font-bold text-ink">Selected fields</div>
              <div className="text-xs text-muted mt-0.5">
                {selected.length} attribute{selected.length === 1 ? "" : "s"} configured
              </div>
            </div>
          </div>

          {selected.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-bg/60 p-7 text-center">
              <div className="mx-auto h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Settings2 className="h-5 w-5 text-muted" />
              </div>
              <div className="mt-3 text-sm font-semibold text-ink">No fields configured</div>
              <div className="text-xs text-muted mt-1">Add attributes from the list below.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {selected.map((attribute, index) => (
                <div
                  key={attribute.attributeId}
                  className="rounded-xl border border-line bg-surface p-3 shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="text-muted cursor-grab shrink-0" title="Field order">
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div className="h-8 w-8 rounded-lg bg-bg flex items-center justify-center text-xs font-bold text-muted shrink-0">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink truncate">
                        {attribute.name}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {attribute.code || attribute.attributeId}
                        {attribute.dataType ? ` · ${attribute.dataType}` : ""}
                      </div>
                    </div>

                    <label className="hidden sm:flex items-center gap-2 text-xs text-muted shrink-0 cursor-pointer">
                      <Checkbox
                        checked={!!attribute.required}
                        onChange={() => toggleRequired(attribute.attributeId)}
                      />
                      Required
                    </label>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="h-7 w-7 rounded-md text-muted hover:bg-bg disabled:opacity-30"
                        aria-label="Move field up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === selected.length - 1}
                        className="h-7 w-7 rounded-md text-muted hover:bg-bg disabled:opacity-30"
                        aria-label="Move field down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAttribute(attribute.attributeId)}
                        className="h-7 w-7 rounded-md text-muted hover:bg-danger/10 hover:text-danger"
                        aria-label={`Remove ${attribute.name}`}
                      >
                        <X className="h-3.5 w-3.5 mx-auto" />
                      </button>
                    </div>
                  </div>

                  <label className="sm:hidden mt-2.5 pl-[5.25rem] flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <Checkbox
                      checked={!!attribute.required}
                      onChange={() => toggleRequired(attribute.attributeId)}
                    />
                    Required field
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-sm font-bold text-ink">Add field</div>
              <div className="text-xs text-muted mt-0.5">Select from your master attributes.</div>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attributes…"
              className="pl-9"
            />
          </div>

          <div className="rounded-2xl border border-line overflow-hidden">
            {available.length === 0 ? (
              <div className="p-5 text-center text-xs text-muted">
                {attributes.length === 0
                  ? "No master attributes available yet."
                  : "No matching attributes available to add."}
              </div>
            ) : (
              <div className="divide-y divide-line">
                {available.map((attribute) => (
                  <button
                    key={attribute.id}
                    type="button"
                    onClick={() => addAttribute(attribute)}
                    className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-bg transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg border border-line bg-surface flex items-center justify-center shrink-0">
                      <Plus className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">{attribute.name}</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {attribute.code || "No code"}
                        {attribute.dataType ? ` · ${attribute.dataType}` : ""}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                      Add
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Sheet>
  );
}
