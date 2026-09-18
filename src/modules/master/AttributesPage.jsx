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

/*
 * FIXED PRODUCT TYPES
 * Product Types are not created by the user.
 * They are automatically ensured in the local/mock store.
 */
const FIXED_PRODUCT_TYPES = [
  { name: "Plywood", code: "PLYWOOD" },
  { name: "Laminate", code: "LAMINATE" },
  { name: "Edge Band", code: "EDGE-BAND" },
  { name: "WPC", code: "WPC" },
  { name: "Fevicol", code: "FEVICOL" },
  { name: "Hardware", code: "HARDWARE" },
];

/*
 * FIXED ATTRIBUTES + VALUES
 *
 * This is the important part.
 * Every Product Type gets its own attribute records/mappings.
 *
 * UI is NOT changed.
 * The existing table and right-side Sheet continue to be used.
 *
 * Values are stored in Attribute Master and later consumed by
 * Product/Bill selectors as horizontal selectable options.
 */
const PRODUCT_TYPE_ATTRIBUTE_CONFIG = {
  Plywood: [
    {
      name: "Thickness",
      values: ["19mm", "18mm", "16mm", "12mm", "9mm", "6mm"],
      required: true,
    },
  ],

  Laminate: [
    {
      name: "Thickness",
      values: ["0.6mm", "0.8mm", "1mm"],
      required: true,
    },
  ],

  "Edge Band": [
    {
      name: "Thickness",
      values: ["0.5mm"],
      required: true,
    },
  ],

  WPC: [
    {
      name: "Size",
      values: ["3x2 inch", "4x2.5 inch"],
      required: true,
    },
  ],

  Fevicol: [
    {
      name: "Pack Size",
      values: ["1/2kg", "1kg", "2kg", "5kg", "10kg", "20kg", "50kg"],
      required: true,
    },
  ],

  Hardware: [
    {
      name: "Size",
      values: ["Small", "Medium", "Large"],
      required: true,
    },
  ],
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

const makeAttributeCode = (attributes = [], name = "ATTR") => {
  const base =
    String(name || "ATTR")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 18) || "ATTR";

  const used = new Set(
    attributes
      .map((item) => String(item.code || "").toUpperCase())
      .filter(Boolean),
  );

  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
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
   * Prevent duplicate automatic setup calls while React/query data
   * is refreshing.
   */
  const setupInProgress = useRef(new Set());

  /*
   * Ensure the six fixed Product Types exist.
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
          console.warn(`Could not create ${type.name}`, error);
        }
      }
    };

    if (Array.isArray(categories)) ensureTypes();

    return () => {
      cancelled = true;
    };
  }, [categories]);

  const fixedCategories = useMemo(() => {
    const byName = new Map();

    for (const category of categories) {
      const key = normalize(category.name);
      if (!key || category.isActive === false) continue;

      if (!byName.has(key)) {
        byName.set(key, category);
      }
    }

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
   * Keep Product Type selection stable.
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

  const {
    data: mappings = [],
    isLoading: mappingsLoading,
  } = useCategoryAttributes(categoryId);

  /*
   * AUTOMATICALLY CONFIGURE THE SELECTED PRODUCT TYPE
   *
   * If Plywood has no attributes, this creates:
   *   Brand
   *   Thickness
   *   Width
   *
   * and maps them to Plywood.
   *
   * It then creates the allowed values.
   *
   * This is why the page will no longer show
   * "No attributes configured" for a fresh Product Type.
   */
  useEffect(() => {
    if (!selectedCategory) return;

    const config =
      PRODUCT_TYPE_ATTRIBUTE_CONFIG[selectedCategory.name];

    if (!config?.length) return;

    const setupKey = selectedCategory.id;

    if (setupInProgress.current.has(setupKey)) return;

    let cancelled = false;
    setupInProgress.current.add(setupKey);

    const setupProductType = async () => {
      try {
        /*
         * Re-read current mappings before creating anything so this
         * remains safe after query refreshes.
         */
        let currentMappings =
          (await import("@/lib/api/repos")).categoryAttributeRepo.list({
            categoryId: selectedCategory.id,
          });

        currentMappings = Array.isArray(currentMappings)
          ? await currentMappings
          : [];

        for (let index = 0; index < config.length; index += 1) {
          if (cancelled) return;

          const definition = config[index];

          /*
           * Attributes are shared master records, but each Product Type
           * gets its own attribute record when a same-named attribute
           * already belongs to another Product Type. This keeps the
           * value list Product-Type-specific.
           */
          const matchingAttributes = attributes.filter(
            (attribute) =>
              normalize(attribute.name) === normalize(definition.name),
          );

          let attribute = matchingAttributes.find((candidate) => {
            return currentMappings.some(
              (mapping) => mapping.attributeId === candidate.id,
            );
          });

          if (!attribute) {
            attribute = matchingAttributes[0] || null;

            /*
             * If the existing shared attribute is already mapped to a
             * different Product Type, create a Product-Type-specific
             * attribute record instead.
             */
            if (attribute) {
              const belongsToCurrentType = currentMappings.some(
                (mapping) => mapping.attributeId === attribute.id,
              );

              if (!belongsToCurrentType) {
                const newCode = makeAttributeCode(
                  attributes,
                  `${selectedCategory.name}-${definition.name}`,
                );

                attribute = await createAttribute.mutateAsync({
                  name: definition.name,
                  code: newCode,
                  dataType: "select",
                  isRequired: definition.required,
                  isActive: true,
                });
              }
            } else {
              attribute = await createAttribute.mutateAsync({
                name: definition.name,
                code: makeAttributeCode(
                  attributes,
                  `${selectedCategory.name}-${definition.name}`,
                ),
                dataType: "select",
                isRequired: definition.required,
                isActive: true,
              });
            }
          }

          const existingMapping = currentMappings.find(
            (mapping) => mapping.attributeId === attribute.id,
          );

          if (!existingMapping) {
            const mapping = await upsertCategoryAttribute.mutateAsync({
              categoryId: selectedCategory.id,
              attributeId: attribute.id,
              isRequired: definition.required,
              sortOrder: index,
            });

            currentMappings = [...currentMappings, mapping];
          }

          /*
           * Seed values only when this attribute currently has no
           * active values. Existing custom values are never overwritten.
           */
          const existingValues = await getAttributeValuesDirect(
            attribute.id,
          );

          const activeValues = existingValues.filter(
            (value) => value.isActive !== false,
          );

          if (activeValues.length === 0) {
            for (let valueIndex = 0; valueIndex < definition.values.length; valueIndex += 1) {
              if (cancelled) return;

              const label = definition.values[valueIndex];

              await createAttributeValue.mutateAsync({
                attributeId: attribute.id,
                label,
                code: makeValueCode(label, activeValues),
                sortOrder: valueIndex,
                isActive: true,
              });

              activeValues.push({
                label,
                code: makeValueCode(label, activeValues),
              });
            }
          }
        }
      } catch (error) {
        console.error(
          `Automatic Product Type setup failed for ${selectedCategory.name}`,
          error,
        );
      } finally {
        if (!cancelled) {
          setupInProgress.current.delete(setupKey);
        }
      }
    };

    setupProductType();

    return () => {
      cancelled = true;
    };
  }, [
    selectedCategory,
    attributes,
    createAttribute,
    upsertCategoryAttribute,
    createAttributeValue,
  ]);

  const configuredAttributes = useMemo(() => {
    /*
     * Only ONE attribute is intentionally visible for each Product Type.
     * These are the exact attribute/value selectors used by the product
     * entry flow shown in the reference UI.
     *
     * Plywood  -> Thickness
     * Laminate -> Thickness
     * Edge Band -> Thickness
     * WPC      -> Size
     * Fevicol  -> Pack Size
     * Hardware -> Size
     *
     * Other mappings may still exist in the data store, but they are not
     * shown here and are not part of this simplified Product Type flow.
     */
    const visibleAttributeName =
      PRODUCT_TYPE_ATTRIBUTE_CONFIG[selectedCategory?.name]?.[0]?.name ||
      null;

    return mappings
      .map((mapping) => {
        const attribute = attributes.find(
          (item) => item.id === mapping.attributeId,
        );

        if (!attribute) return null;

        return {
          ...attribute,
          mappingId: mapping.id,
          isRequired:
            mapping.isRequired ??
            attribute.isRequired ??
            false,
          sortOrder: mapping.sortOrder ?? 0,
        };
      })
      .filter(Boolean)
      .filter(
        (attribute) =>
          normalize(attribute.name) === normalize(visibleAttributeName),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [mappings, attributes, selectedCategory]);

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

    if (
      attributeForm.values.some(
        (value) =>
          value.label.toLowerCase() === clean.toLowerCase(),
      )
    ) {
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

    /*
     * Attribute names are allowed to repeat across Product Types,
     * because values are Product-Type-specific.
     */
    try {
      let attribute = editingAttribute;

      if (editingAttribute) {
        closeAttributeSheet();
        return;
      }

      attribute = await createAttribute.mutateAsync({
        name,
        code: makeAttributeCode(
          attributes,
          `${selectedCategory.name}-${name}`,
        ),
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

      for (let index = 0; index < attributeForm.values.length; index += 1) {
        await createAttributeValue.mutateAsync({
          attributeId: attribute.id,
          label: attributeForm.values[index].label,
          code: makeValueCode(
            attributeForm.values[index].label,
            attributeForm.values.slice(0, index),
          ),
          sortOrder: index,
          isActive: true,
        });
      }

      toast.success(
        attributeForm.values.length
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
                    setSearchParams(id ? { type: id } : {}, {
                      replace: true,
                    });
                  }}
                >
                  {availableCategories.map((item) => (
                    <option key={item.record.id} value={item.record.id}>
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
                  Add and manage only the attributes applicable to this Product
                  Type.
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
                      <div className="font-semibold text-ink">{row.name}</div>
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
                    <AllowedValuesPreview attributeId={row.id} />
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

async function getAttributeValuesDirect(attributeId) {
  const { attributeValueRepo } = await import("@/lib/api/repos");
  const rows = await attributeValueRepo.list({ attributeId });
  return Array.isArray(rows) ? rows : [];
}

function AllowedValuesPreview({ attributeId }) {
  const { data: values = [] } = useAttributeValues(attributeId);

  const activeValues = values.filter(
    (value) => value.isActive !== false,
  );

  if (!activeValues.length) {
    return (
      <span className="text-2xs text-muted">
        No values
      </span>
    );
  }

  return (
    <div className="max-w-[430px] overflow-x-auto scrollbar-thin">
      <div className="flex w-max min-w-full flex-nowrap items-center gap-1.5 py-0.5">
        {activeValues.map((value) => (
          <span
            key={value.id}
            className="inline-flex shrink-0 items-center rounded-md border border-line bg-bg px-2.5 py-1 text-2xs font-semibold text-ink whitespace-nowrap"
          >
            {value.label}
          </span>
        ))}
      </div>
    </div>
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
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Manage Attribute Values"
      subtitle={
        selectedCategory
          ? `${selectedCategory.name} • ${editing?.name || "Attribute"}`
          : "Manage attribute values"
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            onClick={onSave}
            disabled={saving}
          >
            <Check className="h-4 w-4" />
            Save Changes
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
        {/* Product Type + Attribute — READ ONLY CONTEXT */}
        <div className="rounded-xl border border-line bg-bg/50 p-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
            Product Type
          </div>

          <div className="mt-1 text-sm font-bold text-ink">
            {selectedCategory?.name || "—"}
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
              Attribute
            </div>

            <div className="mt-1 text-sm font-bold text-ink">
              {editing?.name || "—"}
            </div>
          </div>
        </div>

        {/* ONLY VALUE INPUT */}
        <div>
          <div className="mb-3">
            <div className="text-xs font-bold text-ink">
              Allowed Values
            </div>

            <p className="mt-0.5 text-[10px] text-muted">
              Add the values users can select for this attribute.
            </p>
          </div>

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
              placeholder="Enter value (e.g. 19mm)"
              autoFocus
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

          {/* EXISTING VALUES */}
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-bg/30 p-2.5 scrollbar-thin">
            <div className="flex w-max min-w-full flex-nowrap items-center gap-1.5">
              {form.values?.map((value) => (
                <span
                  key={value.id}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-2xs font-semibold text-ink whitespace-nowrap"
                >
                  {value.label}

                  <button
                    type="button"
                    onClick={() => onRemoveValue(value.id)}
                    className="rounded-full px-1 text-muted hover:bg-red-50 hover:text-danger"
                    aria-label={`Remove ${value.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}

              {!form.values?.length && (
                <span className="py-1 text-[10px] text-muted">
                  No values configured yet.
                </span>
              )}
            </div>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

function DraftValues({ values, onRemove }) {
  return (
    <div className="mt-3 rounded-xl border border-line bg-bg/30 p-2.5">
      {values.length ? (
        <div className="overflow-x-auto scrollbar-thin">
          <div className="flex w-max min-w-full flex-nowrap items-center gap-1.5">
            {values.map((value) => (
              <span
                key={value.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-2xs font-semibold text-ink whitespace-nowrap"
              >
                {value.label}

                <button
                  type="button"
                  onClick={() => onRemove(value.id)}
                  className="rounded-full px-1 text-muted hover:bg-red-50 hover:text-danger"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-1 text-[10px] text-muted">
          No values added yet.
        </div>
      )}
    </div>
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
          placeholder="Enter another value"
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

      <div className="overflow-x-auto scrollbar-thin rounded-xl border border-line bg-bg/30 p-2.5">
        {activeValues.length ? (
          <div className="flex w-max min-w-full flex-nowrap items-center gap-1.5">
            {activeValues.map((value) => (
              <div
                key={value.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-2xs font-semibold text-ink whitespace-nowrap"
              >
                {editingId === value.id ? (
                  <>
                    <Input
                      value={editingLabel}
                      onChange={(event) =>
                        setEditingLabel(event.target.value)
                      }
                      autoFocus
                      className="h-6 w-[110px] px-2 text-2xs"
                    />

                    <button
                      type="button"
                      className="rounded-full p-1 text-primary-600 hover:bg-primary-500/10"
                      onClick={() => saveValue(value)}
                    >
                      <Check className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      className="rounded-full p-1 text-muted hover:bg-bg"
                      onClick={() => setEditingId("")}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <span>{value.label}</span>

                    <button
                      type="button"
                      className="rounded-full p-1 text-muted hover:bg-bg hover:text-ink"
                      onClick={() => {
                        setEditingId(value.id);
                        setEditingLabel(value.label || "");
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      className="rounded-full p-1 text-muted hover:bg-red-50 hover:text-danger"
                      onClick={() => removeValue(value)}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-1 text-[10px] text-muted">
            No values configured yet.
          </div>
        )}
      </div>
    </div>
  );
}

export default AttributesPage;
