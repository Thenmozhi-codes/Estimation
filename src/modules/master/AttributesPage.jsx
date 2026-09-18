import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { FormGrid } from "@/components/ui/FormGrid";
import { Switch } from "@/components/ui/Switch";

import {
  useCategories,
  useCreateCategory,
  useAttributes,
  useCreateAttribute,
  useUpdateAttribute,
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
import { attributeValueRepo } from "@/lib/api/repos";

/*
 * Product Types are fixed for this ERP flow.
 * Users select a Product Type and manage only its Attributes.
 */
const FIXED_PRODUCT_TYPES = [
  { name: "Plywood", code: "PLYWOOD" },
  { name: "Laminate", code: "LAMINATE" },
  { name: "Edge Band", code: "EDGE-BAND" },
  { name: "WPC", code: "WPC" },
  { name: "Fevicol", code: "FEVICOL" },
];

/*
 * Default values for the Product Types used in this ERP.
 *
 * IMPORTANT:
 * These are only defaults for attributes that already exist/configured.
 * We do NOT create random attributes automatically.
 *
 * If an attribute has zero values, matching values below are added once.
 * Existing values are never deleted or overwritten.
 *
 * This also makes the Attribute Master immediately useful:
 *
 * Plywood  -> Thickness / Length / Width / Grade
 * Laminate -> Thickness / Size
 * Edge Band -> Thickness / Width
 * WPC      -> Size
 * Fevicol  -> Pack Size
 */
const DEFAULT_ATTRIBUTE_VALUES = {
  plywood: {
    thickness: ["6mm", "9mm", "12mm", "16mm", "18mm", "19mm"],
    length: ["8ft", "10ft"],
    width: ["4ft", "6ft"],
    grade: ["MR", "BWR", "BWP", "Marine"],
  },

  laminate: {
    thickness: ["0.6mm", "0.8mm", "1mm"],
    size: ["8x4 ft"],
  },

  "edge band": {
    thickness: ["0.5mm"],
    width: ["19mm", "22mm", "25mm", "32mm", "40mm"],
  },

  wpc: {
    size: ["3x2 inch", "4x2.5 inch"],
  },

  fevicol: {
    "pack size": [
      "1/2kg",
      "1kg",
      "2kg",
      "5kg",
      "10kg",
      "20kg",
      "50kg",
      "1ltr",
      "2ltr",
      "5ltr",
    ],
  },
};

const EMPTY_FORM = {
  name: "",
  isRequired: true,
  values: [],
};

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const makeAttributeCode = (attributes = []) => {
  const used = new Set(
    attributes
      .map((item) => String(item.code || "").toUpperCase())
      .filter(Boolean),
  );

  let index = 1;
  let code = `ATTR-${String(index).padStart(3, "0")}`;

  while (used.has(code)) {
    index += 1;
    code = `ATTR-${String(index).padStart(3, "0")}`;
  }

  return code;
};

const makeValueCode = (label, existingValues = []) => {
  const base =
    String(label || "VALUE")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "VALUE";

  const used = new Set(
    existingValues
      .map((item) => String(item.code || "").toUpperCase())
      .filter(Boolean),
  );

  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;

  return `${base}-${index}`;
};

const getDefaultValuesForAttribute = (productTypeName, attributeName) => {
  const type = normalize(productTypeName);
  const attribute = normalize(attributeName);

  return DEFAULT_ATTRIBUTE_VALUES[type]?.[attribute] || [];
};

export function AttributesPage() {
  const { data: categories = [] } = useCategories();
  const { data: attributes = [] } = useAttributes();

  const createCategory = useCreateCategory();
  const createAttribute = useCreateAttribute();
  const updateAttribute = useUpdateAttribute();

  const upsertCategoryAttribute = useUpsertCategoryAttribute();
  const removeCategoryAttribute = useRemoveCategoryAttribute();

  const createAttributeValue = useCreateAttributeValue();

  const [searchParams, setSearchParams] = useSearchParams();
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");

  const [attributeSheetOpen, setAttributeSheetOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [attributeForm, setAttributeForm] = useState(EMPTY_FORM);
  const [valueDraft, setValueDraft] = useState("");

  /*
   * Prevent the default-value seeding effect from running repeatedly
   * for the same Product Type + Attribute combination.
   */
  const seededKeysRef = useRef(new Set());

  /*
   * Ensure all fixed Product Types exist.
   */
  useEffect(() => {
    let cancelled = false;

    const ensureTypes = async () => {
      const existingNames = new Set(
        categories.map((item) => normalize(item.name)),
      );

      for (const type of FIXED_PRODUCT_TYPES) {
        if (cancelled) return;
        if (existingNames.has(normalize(type.name))) continue;

        try {
          await createCategory.mutateAsync({
            name: type.name,
            code: type.code,
            description: "",
            isActive: true,
          });
        } catch (error) {
          console.warn(
            `Unable to create fixed Product Type: ${type.name}`,
            error,
          );
        }
      }
    };

    if (Array.isArray(categories)) {
      ensureTypes();
    }

    return () => {
      cancelled = true;
    };
  }, [categories]);

  const fixedCategories = useMemo(() => {
    const byName = new Map();

    categories.forEach((item) => {
      const key = normalize(item.name);
      if (!key) return;

      if (!byName.has(key) && item.isActive !== false) {
        byName.set(key, item);
      }
    });

    return FIXED_PRODUCT_TYPES.map((type) => ({
      ...type,
      record: byName.get(normalize(type.name)) || null,
    }));
  }, [categories]);

  const availableCategories = useMemo(
    () => fixedCategories.filter((item) => item.record),
    [fixedCategories],
  );

  /*
   * Always keep a valid Product Type selected.
   */
  useEffect(() => {
    if (!availableCategories.length) return;

    const urlType = searchParams.get("type");

    const urlMatch = availableCategories.find(
      (item) => item.record.id === urlType,
    );

    if (urlMatch) {
      if (categoryId !== urlMatch.record.id) {
        setCategoryId(urlMatch.record.id);
      }
      return;
    }

    const currentStillExists = availableCategories.some(
      (item) => item.record.id === categoryId,
    );

    if (!currentStillExists) {
      const firstId = availableCategories[0].record.id;
      setCategoryId(firstId);
      setSearchParams({ type: firstId }, { replace: true });
    }
  }, [
    availableCategories,
    categoryId,
    searchParams,
    setSearchParams,
  ]);

  const selectedCategory = useMemo(
    () =>
      availableCategories.find((item) => item.record.id === categoryId)
        ?.record || null,
    [availableCategories, categoryId],
  );

  const { data: mappings = [], isLoading: mappingsLoading } =
    useCategoryAttributes(categoryId);

  const configuredAttributes = useMemo(() => {
    return mappings
      .map((mapping) => {
        const attribute = attributes.find(
          (item) => item.id === mapping.attributeId,
        );

        if (!attribute) return null;

        return {
          ...attribute,
          mappingId: mapping.id,
          isRequired: mapping.isRequired ?? attribute.isRequired ?? false,
          sortOrder: mapping.sortOrder ?? 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [mappings, attributes]);

  /*
   * IMPORTANT:
   * If an existing configured attribute has no values, automatically add
   * the predefined values for that Product Type.
   *
   * Example:
   * Plywood + Thickness + no values
   *      ↓
   * 6mm, 9mm, 12mm, 16mm, 18mm, 19mm
   *
   * We only add values when the attribute currently has ZERO active values.
   */
  useEffect(() => {
    if (!selectedCategory || !configuredAttributes.length) return;

    let cancelled = false;

    const seedMissingValues = async () => {
      for (const attribute of configuredAttributes) {
        if (cancelled) return;

        const defaults = getDefaultValuesForAttribute(
          selectedCategory.name,
          attribute.name,
        );

        if (!defaults.length) continue;

        const seedKey = `${selectedCategory.id}:${attribute.id}`;

        if (seededKeysRef.current.has(seedKey)) continue;

        seededKeysRef.current.add(seedKey);

        try {
          const existing = await attributeValueRepo.list({
            attributeId: attribute.id,
          });

          const activeValues = (existing || []).filter(
            (value) => value.isActive !== false,
          );

          /*
           * Do not add defaults if this attribute already has values.
           * This keeps custom values untouched.
           */
          if (activeValues.length > 0) continue;

          for (let index = 0; index < defaults.length; index += 1) {
            if (cancelled) return;

            const label = defaults[index];

            await createAttributeValue.mutateAsync({
              attributeId: attribute.id,
              label,
              code: makeValueCode(label, [
                ...activeValues,
                ...defaults.slice(0, index).map((item) => ({
                  label: item,
                  code: makeValueCode(item),
                })),
              ]),
              sortOrder: index,
              isActive: true,
            });
          }
        } catch (error) {
          console.warn(
            `Unable to seed values for ${attribute.name}`,
            error,
          );
        }
      }
    };

    seedMissingValues();

    return () => {
      cancelled = true;
    };
  }, [selectedCategory, configuredAttributes]);

  const filteredAttributes = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return configuredAttributes;

    return configuredAttributes.filter(
      (item) =>
        String(item.name || "").toLowerCase().includes(term) ||
        String(item.code || "").toLowerCase().includes(term),
    );
  }, [configuredAttributes, search]);

  const closeAttributeSheet = () => {
    setAttributeSheetOpen(false);
    setEditingAttribute(null);
    setAttributeForm(EMPTY_FORM);
    setValueDraft("");
  };

  const openNewAttribute = () => {
    setEditingAttribute(null);

    setAttributeForm({
      name: "",
      isRequired: true,
      values: [],
    });

    setValueDraft("");
    setAttributeSheetOpen(true);
  };

  const openEditAttribute = (attribute) => {
    setEditingAttribute(attribute);

    setAttributeForm({
      name: attribute.name || "",
      isRequired: attribute.isRequired ?? true,
      values: [],
    });

    setValueDraft("");
    setAttributeSheetOpen(true);
  };

  const addDraftValue = () => {
    const clean = valueDraft.trim();

    if (!clean) {
      toast.error("Enter a value first");
      return;
    }

    const exists = attributeForm.values.some(
      (value) => value.label.toLowerCase() === clean.toLowerCase(),
    );

    if (exists) {
      toast.error("This value is already added");
      return;
    }

    setAttributeForm((current) => ({
      ...current,
      values: [
        ...current.values,
        {
          id: `draft-${Date.now()}-${current.values.length}`,
          label: clean,
        },
      ],
    }));

    setValueDraft("");
  };

  const removeDraftValue = (id) => {
    setAttributeForm((current) => ({
      ...current,
      values: current.values.filter((value) => value.id !== id),
    }));
  };

  const createAttributeValueDirect = async (
    attributeId,
    label,
    existingValues = [],
  ) => {
    return createAttributeValue.mutateAsync({
      attributeId,
      label,
      code: makeValueCode(label, existingValues),
      sortOrder: existingValues.length,
      isActive: true,
    });
  };

  const saveAttribute = async () => {
    if (!selectedCategory) {
      toast.error("Select a Product Type");
      return;
    }

    const name = attributeForm.name.trim();

    if (!name) {
      toast.error("Attribute name is required");
      return;
    }

    const duplicate = attributes.find(
      (item) =>
        item.id !== editingAttribute?.id &&
        normalize(item.name) === normalize(name),
    );

    if (duplicate) {
      toast.error("This attribute already exists");
      return;
    }

    try {
      /*
       * EDIT
       */
      if (editingAttribute) {
        const attribute = await updateAttribute.mutateAsync({
          id: editingAttribute.id,
          patch: {
            name,
            isRequired: attributeForm.isRequired,
          },
        });

        await upsertCategoryAttribute.mutateAsync({
          categoryId: selectedCategory.id,
          attributeId: attribute.id,
          isRequired: attributeForm.isRequired,
          sortOrder: editingAttribute.sortOrder ?? 0,
        });

        toast.success("Attribute updated");
        closeAttributeSheet();
        return;
      }

      /*
       * CREATE
       */
      const attribute = await createAttribute.mutateAsync({
        name,
        code: makeAttributeCode(attributes),
        dataType: "select",
        isRequired: attributeForm.isRequired,
        isActive: true,
      });

      await upsertCategoryAttribute.mutateAsync({
        categoryId: selectedCategory.id,
        attributeId: attribute.id,
        isRequired: attributeForm.isRequired,
        sortOrder: configuredAttributes.length,
      });

      /*
       * Values entered manually in the same form.
       */
      const manuallyEnteredValues = [];

      for (const draft of attributeForm.values) {
        const createdValue = await createAttributeValueDirect(
          attribute.id,
          draft.label,
          manuallyEnteredValues,
        );

        manuallyEnteredValues.push(createdValue);
      }

      /*
       * If the user did not manually enter values, use the predefined
       * values for this Product Type + Attribute.
       *
       * Example:
       * New Plywood attribute "Thickness"
       *      ↓
       * automatically gets 6mm, 9mm, 12mm, 16mm, 18mm, 19mm
       */
      if (manuallyEnteredValues.length === 0) {
        const defaults = getDefaultValuesForAttribute(
          selectedCategory.name,
          name,
        );

        for (let index = 0; index < defaults.length; index += 1) {
          const label = defaults[index];

          const createdValue = await createAttributeValueDirect(
            attribute.id,
            label,
            manuallyEnteredValues,
          );

          manuallyEnteredValues.push(createdValue);
        }
      }

      toast.success(
        manuallyEnteredValues.length
          ? "Attribute and values added"
          : "Attribute added",
      );

      closeAttributeSheet();
    } catch (error) {
      console.error("Attribute save failed:", error);
      toast.error(error?.message || "Could not save attribute");
    }
  };

  const removeAttribute = async (attribute) => {
    const confirmed = window.confirm(
      `Remove "${attribute.name}" from ${selectedCategory?.name}?`,
    );

    if (!confirmed) return;

    try {
      await removeCategoryAttribute.mutateAsync({
        id: attribute.mappingId,
        categoryId: selectedCategory.id,
      });

      toast.success("Attribute removed");
    } catch (error) {
      toast.error(error?.message || "Could not remove attribute");
    }
  };

  const toggleRequired = async (attribute) => {
    try {
      await upsertCategoryAttribute.mutateAsync({
        categoryId: selectedCategory.id,
        attributeId: attribute.id,
        isRequired: !attribute.isRequired,
        sortOrder: attribute.sortOrder,
      });

      toast.success(
        `${attribute.name} marked ${
          !attribute.isRequired ? "required" : "optional"
        }`,
      );
    } catch (error) {
      toast.error(error?.message || "Could not update attribute");
    }
  };

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title="Attributes"
        description="Configure attributes and allowed values for each Product Type."
        actions={
          <Button
            size="sm"
            onClick={openNewAttribute}
            disabled={!selectedCategory}
          >
            <Plus className="h-4 w-4" />
            New Attribute
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-24">
        <div className="mx-auto max-w-6xl space-y-4">
          <Card>
            <CardBody className="p-4 md:p-5">
              <Field label="Product Type" required>
                <Select
                  value={categoryId}
                  onChange={(event) => {
                    const id = event.target.value;

                    setCategoryId(id);
                    setSearch("");
                    setSearchParams(
                      id ? { type: id } : {},
                      { replace: true },
                    );
                  }}
                >
                  {availableCategories.map((item) => (
                    <option
                      key={item.record.id}
                      value={item.record.id}
                    >
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
              <div>
                <h2 className="text-sm font-bold text-ink">
                  {selectedCategory?.name || "Product Type"} Attributes
                </h2>

                <p className="mt-0.5 text-[10px] text-muted">
                  Add and manage only the attributes applicable to this
                  Product Type.
                </p>
              </div>

              <div className="sm:w-[280px]">
                <Toolbar
                  search={search}
                  onSearch={setSearch}
                  placeholder="Search attributes…"
                />
              </div>
            </div>

            <DataTable
              columns={[
                {
                  key: "name",
                  header: "Attribute",
                  sortable: true,
                  render: (row) => (
                    <div>
                      <div className="font-semibold text-ink">
                        {row.name}
                      </div>
                      <div className="text-2xs text-muted">
                        {row.isRequired ? "Required" : "Optional"}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "values",
                  header: "Allowed Values",
                  render: (row) => (
                    <ValueCount attributeId={row.id} />
                  ),
                },
                {
                  key: "required",
                  header: "Required",
                  hideOnMobile: true,
                  render: (row) => (
                    <span className="text-2xs font-semibold text-muted">
                      {row.isRequired ? "Yes" : "No"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  width: 230,
                  align: "right",
                  render: (row) => (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg px-2.5 py-1.5 text-2xs font-semibold text-ink hover:bg-bg"
                        onClick={() => openEditAttribute(row)}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Pencil className="h-3 w-3" />
                          Edit
                        </span>
                      </button>

                      <button
                        type="button"
                        className="rounded-lg px-2.5 py-1.5 text-2xs font-semibold text-primary-600 hover:bg-primary-500/10"
                        onClick={() => toggleRequired(row)}
                      >
                        {row.isRequired ? "Optional" : "Required"}
                      </button>

                      <button
                        type="button"
                        className="rounded-lg px-2.5 py-1.5 text-2xs font-semibold text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => removeAttribute(row)}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </span>
                      </button>
                    </div>
                  ),
                },
              ]}
              rows={filteredAttributes}
              loading={mappingsLoading}
              emptyTitle="No attributes configured"
              emptyDescription={
                selectedCategory
                  ? `Add attributes for ${selectedCategory.name}.`
                  : "Select a Product Type first."
              }
              emptyAction={
                <Button
                  onClick={openNewAttribute}
                  disabled={!selectedCategory}
                >
                  <Plus className="h-4 w-4" />
                  New Attribute
                </Button>
              }
            />
          </Card>
        </div>
      </div>

      <AttributeSheet
        open={attributeSheetOpen}
        onClose={closeAttributeSheet}
        selectedCategory={selectedCategory}
        editing={editingAttribute}
        form={attributeForm}
        setForm={setAttributeForm}
        valueDraft={valueDraft}
        setValueDraft={setValueDraft}
        onAddValue={addDraftValue}
        onRemoveValue={removeDraftValue}
        onSave={saveAttribute}
        saving={
          createAttribute.isPending ||
          updateAttribute.isPending ||
          upsertCategoryAttribute.isPending ||
          createAttributeValue.isPending
        }
      />
    </div>
  );
}

function ValueCount({ attributeId }) {
  const { data: values = [] } = useAttributeValues(attributeId);

  const count = values.filter(
    (value) => value.isActive !== false,
  ).length;

  return (
    <span className="inline-flex rounded-full border border-line bg-bg px-2.5 py-1 text-2xs font-semibold text-ink">
      {count} value{count === 1 ? "" : "s"}
    </span>
  );
}

function AttributeSheet({
  open,
  onClose,
  selectedCategory,
  editing,
  form,
  setForm,
  valueDraft,
  setValueDraft,
  onAddValue,
  onRemoveValue,
  onSave,
  saving,
}) {
  /*
   * Show suggested defaults inside the New Attribute form.
   * User can still manually add/change values.
   */
  const suggestedValues = useMemo(() => {
    if (editing || !selectedCategory) return [];

    return getDefaultValuesForAttribute(
      selectedCategory.name,
      form.name,
    );
  }, [editing, selectedCategory, form.name]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit Attribute" : "New Attribute"}
      subtitle={
        selectedCategory
          ? `Configure an attribute for ${selectedCategory.name}`
          : "Select a Product Type"
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
          >
            <Check className="h-4 w-4" />
            {editing ? "Save Changes" : "Add Attribute"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="rounded-xl border border-line bg-bg/50 p-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
            Product Type
          </div>

          <div className="mt-1 text-sm font-bold text-ink">
            {selectedCategory?.name || "—"}
          </div>

          <p className="mt-1 text-[10px] leading-4 text-muted">
            Values configured here will be available for this Product Type.
          </p>
        </div>

        <FormGrid cols={1}>
          <Field label="Attribute Name" required>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="e.g. Thickness"
              autoFocus
            />
          </Field>

          <Field label="Required">
            <div className="flex h-9 items-center">
              <Switch
                checked={form.isRequired}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    isRequired: value,
                  }))
                }
                label={
                  form.isRequired ? "Required" : "Optional"
                }
              />
            </div>
          </Field>
        </FormGrid>

        <div className="border-t border-line pt-5">
          <div className="mb-3">
            <div className="text-xs font-bold text-ink">
              Allowed Values
            </div>

            <p className="mt-0.5 text-[10px] text-muted">
              Add the values users can select for this attribute.
            </p>
          </div>

          {!editing && (
            <>
              {suggestedValues.length > 0 && (
                <div className="mb-3 rounded-xl border border-primary-500/15 bg-primary-500/5 p-3">
                  <div className="text-[10px] font-bold text-primary-600">
                    Suggested values for {selectedCategory?.name}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestedValues.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="rounded-full border border-primary-500/20 bg-surface px-2.5 py-1 text-2xs font-semibold text-ink hover:border-primary-500 hover:bg-primary-500/10"
                        onClick={() => {
                          setForm((current) => {
                            const exists = current.values.some(
                              (item) =>
                                item.label.toLowerCase() ===
                                value.toLowerCase(),
                            );

                            if (exists) return current;

                            return {
                              ...current,
                              values: [
                                ...current.values,
                                {
                                  id: `suggested-${Date.now()}-${value}`,
                                  label: value,
                                },
                              ],
                            };
                          });
                        }}
                      >
                        + {value}
                      </button>
                    ))}
                  </div>

                  <p className="mt-2 text-[9px] text-muted">
                    These are optional suggestions. You can also enter your
                    own values below.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={valueDraft}
                  onChange={(event) =>
                    setValueDraft(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onAddValue();
                    }
                  }}
                  placeholder="e.g. 19mm"
                />

                <Button
                  type="button"
                  variant="subtle"
                  onClick={onAddValue}
                  disabled={!valueDraft.trim()}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              <div className="mt-3 min-h-10 rounded-xl border border-dashed border-line p-2.5">
                {form.values.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {form.values.map((value) => (
                      <span
                        key={value.id}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-bg px-2.5 py-1 text-2xs font-semibold text-ink"
                      >
                        {value.label}

                        <button
                          type="button"
                          onClick={() =>
                            onRemoveValue(value.id)
                          }
                          className="rounded-full p-0.5 text-muted hover:bg-red-50 hover:text-danger"
                          aria-label={`Remove ${value.label}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="py-1 text-[10px] text-muted">
                    No values selected yet.
                  </div>
                )}
              </div>
            </>
          )}

          {editing && (
            <ExistingValues attributeId={editing.id} />
          )}
        </div>
      </form>
    </Sheet>
  );
}

function ExistingValues({ attributeId }) {
  const { data: values = [], isLoading } =
    useAttributeValues(attributeId);

  const updateValue = useUpdateAttributeValue();
  const deleteValue = useDeleteAttributeValue();
  const createValue = useCreateAttributeValue();

  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingLabel, setEditingLabel] = useState("");

  const activeValues = values.filter(
    (value) => value.isActive !== false,
  );

  const addValue = async () => {
    const label = newValue.trim();

    if (!label) return;

    if (
      activeValues.some(
        (value) =>
          value.label?.toLowerCase() === label.toLowerCase(),
      )
    ) {
      toast.error("This value already exists");
      return;
    }

    try {
      await createValue.mutateAsync({
        attributeId,
        label,
        code: makeValueCode(label, activeValues),
        sortOrder: activeValues.length,
        isActive: true,
      });

      setNewValue("");
      toast.success("Value added");
    } catch (error) {
      toast.error(error?.message || "Could not add value");
    }
  };

  const saveValue = async (value) => {
    const label = editingLabel.trim();

    if (!label) return;

    if (
      activeValues.some(
        (item) =>
          item.id !== value.id &&
          item.label?.toLowerCase() === label.toLowerCase(),
      )
    ) {
      toast.error("This value already exists");
      return;
    }

    try {
      await updateValue.mutateAsync({
        id: value.id,
        patch: {
          label,
          attributeId,
        },
      });

      setEditingId("");
      setEditingLabel("");
      toast.success("Value updated");
    } catch (error) {
      toast.error(error?.message || "Could not update value");
    }
  };

  const removeValue = async (value) => {
    if (!window.confirm(`Delete "${value.label}"?`)) return;

    try {
      await deleteValue.mutateAsync({
        id: value.id,
        attributeId,
      });

      toast.success("Value deleted");
    } catch (error) {
      toast.error(error?.message || "Could not delete value");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          placeholder="Add another value"
          disabled={isLoading}
        />

        <Button
          type="button"
          variant="subtle"
          onClick={addValue}
          disabled={!newValue.trim() || createValue.isPending}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="space-y-1.5">
        {activeValues.map((value) => (
          <div
            key={value.id}
            className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-2.5 py-2"
          >
            {editingId === value.id ? (
              <>
                <Input
                  value={editingLabel}
                  onChange={(event) =>
                    setEditingLabel(event.target.value)
                  }
                  autoFocus
                />

                <button
                  type="button"
                  className="rounded-lg p-2 text-primary-600 hover:bg-primary-500/10"
                  onClick={() => saveValue(value)}
                >
                  <Check className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  className="rounded-lg p-2 text-muted hover:bg-bg"
                  onClick={() => setEditingId("")}
                >
                  ×
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-xs font-medium text-ink">
                  {value.label}
                </span>

                <button
                  type="button"
                  className="rounded-lg p-2 text-muted hover:bg-bg"
                  onClick={() => {
                    setEditingId(value.id);
                    setEditingLabel(value.label || "");
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  className="rounded-lg p-2 text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => removeValue(value)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}

        {!isLoading && !activeValues.length && (
          <div className="rounded-xl border border-dashed border-line p-3 text-[10px] text-muted">
            No values configured yet.
          </div>
        )}
      </div>
    </div>
  );
}

export default AttributesPage;
