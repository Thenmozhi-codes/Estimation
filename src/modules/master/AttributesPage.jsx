import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";

import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useAttributes,
  useCreateAttribute,
  useCategoryAttributes,
  useUpsertCategoryAttribute,
  useRemoveCategoryAttribute,
  useAttributeValues,
  useCreateAttributeValue,
  useUpdateAttributeValue,
  useDeleteAttributeValue,
} from "@/hooks/useMasters";

import { MODULE_TABS } from "@/app/moduleNav";
import { toast } from "@/lib/toast";
import { toCode } from "@/lib/utils/code";

function makeAttributeCode(attributes = []) {
  const used = new Set(
    attributes
      .map((item) => item.code)
      .filter(Boolean)
      .map((code) => String(code).toUpperCase()),
  );

  let n = 1;
  while (used.has(`ATTR-${String(n).padStart(3, "0")}`)) n += 1;
  return `ATTR-${String(n).padStart(3, "0")}`;
}

function makeValueCode(attribute, label, values = []) {
  const prefix = String(attribute?.code || attribute?.name || "VAL")
    .replace(/^ATTR-/i, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 5) || "VAL";

  const valuePart = String(label || "")
    .trim()
    .toUpperCase()
    .replace(/MM\b/g, "")
    .replace(/FT\b/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "OPT";

  const base = `${prefix}-${valuePart}`;
  const used = new Set(
    values
      .map((item) => item.code)
      .filter(Boolean)
      .map((code) => String(code).toUpperCase()),
  );

  if (!used.has(base)) return base;

  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function AttributesPage() {
  const { data: categories = [] } = useCategories();
  const { data: attributes = [] } = useAttributes();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createAttribute = useCreateAttribute();

  const upsertMapping = useUpsertCategoryAttribute();
  const removeMapping = useRemoveCategoryAttribute();

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = searchParams.get("type");

  const [categoryId, setCategoryId] = useState(requestedType || "");
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [attributePickerOpen, setAttributePickerOpen] = useState(false);
  const [attributeSearch, setAttributeSearch] = useState("");

  // Deep-linked from Product Master ("Configure in Attribute Master"):
  // land straight on that Product Type once it's loaded.
  useEffect(() => {
    if (!categories.length) return;
    if (requestedType && categories.some((c) => c.id === requestedType)) {
      setCategoryId(requestedType);
      return;
    }
    if (!categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId, requestedType]);

  const handleCategoryChange = (id) => {
    setCategoryId(id);
    setSearchParams(id ? { type: id } : {}, { replace: true });
  };

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === categoryId) || null,
    [categories, categoryId],
  );

  const { data: mappings = [] } = useCategoryAttributes(categoryId);

  const configuredAttributes = useMemo(
    () =>
      mappings
        .map((mapping) => {
          const attribute = attributes.find(
            (item) => item.id === mapping.attributeId,
          );
          if (!attribute) return null;
          return {
            ...attribute,
            mappingId: mapping.id,
            isRequired: mapping.isRequired ?? true,
            sortOrder: mapping.sortOrder ?? 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [mappings, attributes],
  );

  const mappedIds = useMemo(
    () => new Set(mappings.map((item) => item.attributeId)),
    [mappings],
  );

  const availableAttributes = useMemo(() => {
    const term = attributeSearch.trim().toLowerCase();
    return attributes.filter((attribute) => {
      if (mappedIds.has(attribute.id)) return false;
      if (!term) return true;
      return (
        attribute.name?.toLowerCase().includes(term) ||
        attribute.code?.toLowerCase().includes(term)
      );
    });
  }, [attributes, mappedIds, attributeSearch]);

  const addAttribute = async (attribute) => {
    try {
      await upsertMapping.mutateAsync({
        categoryId,
        attributeId: attribute.id,
        isRequired: true,
        sortOrder: configuredAttributes.length,
      });
      setAttributePickerOpen(false);
      setAttributeSearch("");
      toast.success(`${attribute.name} added`);
    } catch (error) {
      toast.error(error?.message || "Could not add attribute");
    }
  };

  const createAndAddAttribute = async (name) => {
    const clean = name.trim();
    if (!clean) return toast.error("Attribute name is required");

    const duplicate = attributes.find(
      (item) => item.name?.trim().toLowerCase() === clean.toLowerCase(),
    );
    if (duplicate) return toast.error("This attribute already exists");

    try {
      const created = await createAttribute.mutateAsync({
        name: clean,
        code: makeAttributeCode(attributes),
        dataType: "select",
        isRequired: true,
      });

      await upsertMapping.mutateAsync({
        categoryId,
        attributeId: created.id,
        isRequired: true,
        sortOrder: configuredAttributes.length,
      });

      setAttributePickerOpen(false);
      setAttributeSearch("");
      toast.success(`${clean} created and added`);
    } catch (error) {
      toast.error(error?.message || "Could not create attribute");
    }
  };

  const removeAttribute = async (attribute) => {
    if (
      !window.confirm(`Remove "${attribute.name}" from ${selectedCategory?.name}?`)
    )
      return;
    try {
      await removeMapping.mutateAsync({
        id: attribute.mappingId,
        categoryId,
      });
      toast.success(`${attribute.name} removed`);
    } catch (error) {
      toast.error(error?.message || "Could not remove attribute");
    }
  };

  const toggleRequired = async (attribute) => {
    try {
      await upsertMapping.mutateAsync({
        categoryId,
        attributeId: attribute.id,
        isRequired: !attribute.isRequired,
        sortOrder: attribute.sortOrder,
      });
    } catch (error) {
      toast.error(error?.message || "Could not update attribute");
    }
  };

  const saveProductType = async ({ name, code, editing }) => {
    const clean = name.trim();
    if (!clean) return toast.error("Product type name is required");

    try {
      const finalCode = code.trim() || toCode(clean);
      if (editing) {
        await updateCategory.mutateAsync({
          id: editing.id,
          patch: { name: clean, code: finalCode },
        });
        toast.success("Product type updated");
      } else {
        const created = await createCategory.mutateAsync({
          name: clean,
          code: finalCode,
          isActive: true,
        });
        if (created?.id) {
          handleCategoryChange(created.id);
        }
        toast.success("Product type created");
      }
      setShowTypeModal(false);
      setEditingType(null);
    } catch (error) {
      toast.error(error?.message || "Could not save product type");
    }
  };

  const deleteProductType = async () => {
    if (!selectedCategory) return;
    if (!window.confirm(`Delete "${selectedCategory.name}"?`)) return;

    try {
      await deleteCategory.mutateAsync(selectedCategory.id);
      const next = categories.find((item) => item.id !== selectedCategory.id);
      handleCategoryChange(next?.id || "");
      toast.success("Product type deleted");
    } catch (error) {
      toast.error(error?.message || "Could not delete product type");
    }
  };

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title="Attributes"
        description="Choose a product type, then define the attributes and allowed values for it."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingType(null);
              setShowTypeModal(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Product Type
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-24">
        <div className="max-w-5xl mx-auto space-y-4">
          <Card>
            <CardBody className="p-5">
              <Field label="Product Type" required>
                <Select
                  value={categoryId}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                >
                  <option value="">Select product type</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedCategory && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted">
                    Configure the values that belong to{" "}
                    <b className="text-ink">{selectedCategory.name}</b>.
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        setEditingType(selectedCategory);
                        setShowTypeModal(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Type
                    </Button>
                    <button
                      type="button"
                      onClick={deleteProductType}
                      className="h-9 w-9 rounded-lg border border-line flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {selectedCategory ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-ink">
                    {selectedCategory.name} configuration
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    Each attribute has its own controlled value list.
                  </p>
                </div>

                <AttributePicker
                  open={attributePickerOpen}
                  setOpen={setAttributePickerOpen}
                  attributes={availableAttributes}
                  search={attributeSearch}
                  setSearch={setAttributeSearch}
                  onSelect={addAttribute}
                  onCreate={createAndAddAttribute}
                  creating={createAttribute.isPending}
                />
              </div>

              {configuredAttributes.length === 0 ? (
                <Card>
                  <CardBody className="py-14 text-center">
                    <Settings2 className="h-6 w-6 mx-auto text-muted" />
                    <h3 className="mt-3 text-sm font-bold text-ink">
                      No attributes yet
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Add Thickness, Length, Width, Grade or any other attribute.
                    </p>
                    <div className="mt-4">
                      <AttributePicker
                        open={attributePickerOpen}
                        setOpen={setAttributePickerOpen}
                        attributes={availableAttributes}
                        search={attributeSearch}
                        setSearch={setAttributeSearch}
                        onSelect={addAttribute}
                        onCreate={createAndAddAttribute}
                        creating={createAttribute.isPending}
                        fullButton
                      />
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <div className="space-y-3">
                  {configuredAttributes.map((attribute, index) => (
                    <AttributeRow
                      key={attribute.id}
                      attribute={attribute}
                      index={index}
                      onRemove={() => removeAttribute(attribute)}
                      onToggleRequired={() => toggleRequired(attribute)}
                    />
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 px-4 py-3 text-[11px] text-muted">
                <span className="font-bold text-ink">One source of truth:</span>{" "}
                values configured here are the only values available to the rest
                of the ERP.
              </div>
            </>
          ) : (
            <Card>
              <CardBody className="py-14 text-center">
                <Settings2 className="h-6 w-6 mx-auto text-muted" />
                <h3 className="mt-3 text-sm font-bold text-ink">
                  Select a product type
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Start by choosing the product type you want to configure.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {showTypeModal && (
        <ProductTypeModal
          editing={editingType}
          saving={createCategory.isPending || updateCategory.isPending}
          onClose={() => {
            setShowTypeModal(false);
            setEditingType(null);
          }}
          onSave={saveProductType}
        />
      )}
    </div>
  );
}

function AttributeRow({ attribute, index, onRemove, onToggleRequired }) {
  const [open, setOpen] = useState(false);
  const { data: values = [] } = useAttributeValues(attribute.id);
  const activeValues = values.filter((item) => item.isActive !== false);

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-visible">
      <div className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-bg border border-line flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-primary-500">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink">{attribute.name}</h3>
            {attribute.isRequired && (
              <span className="text-[9px] font-bold text-primary-500">
                Required
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted mt-0.5">
            {activeValues.length} allowed value
            {activeValues.length === 1 ? "" : "s"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="h-9 min-w-[140px] px-3 rounded-lg border border-line bg-bg flex items-center justify-between gap-3 hover:border-primary-500/30"
        >
          <span className="text-[10px] font-bold text-ink">
            {activeValues.length ? "View values" : "Add values"}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        <button
          type="button"
          onClick={onToggleRequired}
          className={`hidden md:flex h-9 px-2.5 rounded-lg border items-center gap-1.5 text-[9px] font-bold ${
            attribute.isRequired
              ? "border-primary-500/20 bg-primary-500/5 text-primary-500"
              : "border-line text-muted"
          }`}
        >
          <Check className="h-3 w-3" />
          Required
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="h-9 w-9 rounded-lg flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && <ValueManager attribute={attribute} values={activeValues} />}
    </div>
  );
}

function ValueManager({ attribute, values }) {
  const createValue = useCreateAttributeValue();
  const updateValue = useUpdateAttributeValue();
  const deleteValue = useDeleteAttributeValue();

  const [selectedValueId, setSelectedValueId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editing, setEditing] = useState(false);

  const selectedValue =
    values.find((item) => item.id === selectedValueId) || null;

  const addValue = async () => {
    const label = newValue.trim();
    if (!label) return toast.error("Enter a value");
    if (
      values.some(
        (item) =>
          item.label?.trim().toLowerCase() === label.toLowerCase(),
      )
    ) {
      return toast.error("This value already exists");
    }

    try {
      await createValue.mutateAsync({
        attributeId: attribute.id,
        label,
        code: makeValueCode(attribute, label, values),
      });
      setNewValue("");
      toast.success(`${label} added`);
    } catch (error) {
      toast.error(error?.message || "Could not add value");
    }
  };

  const saveEdit = async () => {
    if (!selectedValue) return;
    const label = newValue.trim();
    if (!label) return toast.error("Enter a value");

    try {
      await updateValue.mutateAsync({
        id: selectedValue.id,
        patch: { label },
      });
      setEditing(false);
      setNewValue("");
      setSelectedValueId("");
      toast.success("Value updated");
    } catch (error) {
      toast.error(error?.message || "Could not update value");
    }
  };

  const removeValue = async () => {
    if (!selectedValue) return;
    if (!window.confirm(`Remove "${selectedValue.label}"?`)) return;

    try {
      await deleteValue.mutateAsync({ id: selectedValue.id });
      setSelectedValueId("");
      toast.success(`${selectedValue.label} removed`);
    } catch (error) {
      toast.error(error?.message || "Could not remove value");
    }
  };

  const startEdit = () => {
    if (!selectedValue) return;
    setNewValue(selectedValue.label || "");
    setEditing(true);
  };

  return (
    <div className="border-t border-line px-4 py-4 bg-bg/30">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <Field label={`${attribute.name} values`}>
          <Select
            value={selectedValueId}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedValueId(id);
              const value = values.find((item) => item.id === id);
              if (!editing) setNewValue(value?.label || "");
            }}
          >
            <option value="">Select a value…</option>
            {values.map((value) => (
              <option key={value.id} value={value.id}>
                {value.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={editing ? "Edit selected value" : "Add new value"}>
          <Input
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            placeholder={
              attribute.name === "Thickness" ? "e.g. 19mm" : "Enter value"
            }
          />
        </Field>

        <div className="flex items-center gap-2">
          {selectedValue && !editing && (
            <>
              <Button size="sm" variant="subtle" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                onClick={removeValue}
                className="h-9 w-9 rounded-lg border border-line text-muted hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          <Button
            size="sm"
            onClick={editing ? saveEdit : addValue}
            disabled={
              createValue.isPending || updateValue.isPending || !newValue.trim()
            }
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editing ? "Save" : "Add"}
          </Button>

          {editing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setNewValue(selectedValue?.label || "");
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 text-[10px] text-muted">
        The dropdown above contains the complete allowed-value list for this
        attribute.
      </div>
    </div>
  );
}

function AttributePicker({
  open,
  setOpen,
  attributes,
  search,
  setSearch,
  onSelect,
  onCreate,
  creating,
  fullButton = false,
}) {
  const [creatingMode, setCreatingMode] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-9 px-3 rounded-lg border border-line bg-surface text-xs font-bold text-ink flex items-center gap-2 hover:border-primary-500/30 hover:bg-primary-500/5"
      >
        <Plus className="h-3.5 w-3.5 text-primary-500" />
        Add Attribute
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute ${
              fullButton ? "left-1/2 -translate-x-1/2" : "right-0"
            } top-[calc(100%+8px)] z-50 w-[310px] rounded-xl border border-line bg-surface shadow-2xl overflow-hidden`}
          >
            <div className="p-3 border-b border-line">
              <div className="text-xs font-bold text-ink">Choose Attribute</div>
              <div className="text-[9px] text-muted mt-0.5">
                Select an existing master attribute.
              </div>
              <div className="relative mt-2.5">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search attributes…"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto p-2">
              {attributes.length ? (
                <div className="space-y-1">
                  {attributes.map((attribute) => (
                    <button
                      key={attribute.id}
                      type="button"
                      onClick={() => onSelect(attribute)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left hover:bg-bg"
                    >
                      <div className="h-8 w-8 rounded-lg bg-bg border border-line flex items-center justify-center shrink-0">
                        <Settings2 className="h-3.5 w-3.5 text-primary-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-ink">
                          {attribute.name}
                        </div>
                        <div className="text-[8px] font-mono text-muted mt-0.5">
                          {attribute.code || "ATTRIBUTE"}
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-7 text-center text-[10px] text-muted">
                  No matching attributes.
                </div>
              )}
            </div>

            <div className="border-t border-line p-2.5">
              {!creatingMode ? (
                <button
                  type="button"
                  onClick={() => setCreatingMode(true)}
                  className="w-full rounded-lg border border-dashed border-line p-2.5 text-left hover:border-primary-500/30 hover:bg-primary-500/5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-bg border border-line flex items-center justify-center">
                      <Plus className="h-3.5 w-3.5 text-primary-500" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-ink">
                        Create new attribute
                      </div>
                      <div className="text-[8px] text-muted mt-0.5">
                        It will be added to this product type.
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                <div>
                  <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="e.g. Thickness"
                    autoFocus
                  />
                  <div className="flex gap-1.5 mt-2">
                    <Button
                      size="sm"
                      onClick={() => onCreate(newName)}
                      disabled={creating || !newName.trim()}
                    >
                      <Plus className="h-3 w-3" />
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCreatingMode(false);
                        setNewName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProductTypeModal({ editing, saving, onClose, onSave }) {
  const [name, setName] = useState(editing?.name || "");
  const [code, setCode] = useState(editing?.code || "");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">
              {editing ? "Edit Product Type" : "New Product Type"}
            </h3>
            <p className="text-[10px] text-muted mt-0.5">Example: Plywood</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:bg-bg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Product Type" required>
            <Input
              value={name}
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                if (!editing) setCode(toCode(value));
              }}
              placeholder="e.g. Plywood"
              autoFocus
            />
          </Field>
          <Field label="Code" hint="Generated automatically.">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="PLYWOOD"
              className="font-mono"
            />
          </Field>
        </div>

        <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ name, code, editing })}
            disabled={saving || !name.trim()}
          >
            <Check className="h-4 w-4" />
            {editing ? "Save Changes" : "Create Type"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AttributesPage;