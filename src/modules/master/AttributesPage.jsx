import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";

import {
  useCategories,
  useCreateCategory,
  useAttributes,
  useCreateAttribute,
  useCategoryAttributes,
  useUpsertCategoryAttribute,
  useAttributeValues,
  useCreateAttributeValue,
  useUpdateAttributeValue,
  useDeleteAttributeValue,
} from "@/hooks/useMasters";

import { MODULE_TABS } from "@/app/moduleNav";
import { toast } from "@/lib/toast";
import {
  categoryAttributeRepo,
  attributeValueRepo,
} from "@/lib/api/repos";

/*
 * ATTRIBUTE MASTER
 *
 * Main page
 *   - Clean attribute list
 *   - Search
 *   - Add Attribute button
 *   - Edit Values for an existing attribute
 *
 * Add Attribute
 *   Product Type
 *   Attribute Name
 *   Allowed Values
 *
 * Edit Values
 *   Product Type
 *   Attribute (read-only)
 *   Allowed Values
 *
 * Product Types are fixed:
 *   Plywood, Laminate, Edge Band, WPC, Fevicol, Hardware
 */

const FIXED_PRODUCT_TYPES = [
  { name: "Plywood", code: "PLYWOOD" },
  { name: "Laminate", code: "LAMINATE" },
  { name: "Edge Band", code: "EDGE-BAND" },
  { name: "WPC", code: "WPC" },
  { name: "Fevicol", code: "FEVICOL" },
  { name: "Hardware", code: "HARDWARE" },
];

const PRODUCT_TYPE_ATTRIBUTE_CONFIG = {
  Plywood: {
    attribute: "Thickness",
    values: ["19mm", "18mm", "16mm", "12mm", "9mm", "6mm"],
  },
  Laminate: {
    attribute: "Thickness",
    values: ["0.6mm", "0.8mm", "1mm"],
  },
  "Edge Band": {
    attribute: "Thickness",
    values: ["0.5mm"],
  },
  WPC: {
    attribute: "Size",
    values: ["3x2 inch", "4x2.5 inch"],
  },
  Fevicol: {
    attribute: "Pack Size",
    values: ["1/2kg", "1kg", "2kg", "5kg", "10kg", "20kg", "50kg"],
  },
  Hardware: {
    attribute: "Size",
    values: ["Small", "Medium", "Large"],
  },
};

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const makeCode = (value, fallback = "VALUE") =>
  String(value || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || fallback;

const makeUniqueCode = (label, existing = []) => {
  const base = makeCode(label);
  const used = new Set(
    existing
      .map((item) => String(item?.code || "").toUpperCase())
      .filter(Boolean),
  );

  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
};

const uniqueByName = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = normalize(item?.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function AttributesPage() {
  const { data: categories = [] } = useCategories();
  const { data: attributes = [] } = useAttributes();

  const createCategory = useCreateCategory();
  const createAttribute = useCreateAttribute();
  const upsertCategoryAttribute = useUpsertCategoryAttribute();
  const createAttributeValue = useCreateAttributeValue();

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);

  const [valuesSheetOpen, setValuesSheetOpen] = useState(false);
  const [valuesSheetCategoryId, setValuesSheetCategoryId] = useState("");
  const [valuesSheetAttributeId, setValuesSheetAttributeId] = useState("");

  const [newAttributeOpen, setNewAttributeOpen] = useState(false);

  const setupInProgress = useRef(new Set());

  /*
   * Keep the six fixed Product Types available.
   * Product Types are not created/edited from the visible UI.
   */
  useEffect(() => {
    let cancelled = false;

    const ensureTypes = async () => {
      const existingNames = new Set(
        categories.map((item) => normalize(item?.name)),
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
          console.warn(`Could not create fixed type ${type.name}`, error);
        }
      }
    };

    if (Array.isArray(categories)) ensureTypes();

    return () => {
      cancelled = true;
    };
  }, [categories, createCategory]);

  /*
   * De-duplicate Product Types by name.
   * This also prevents duplicate options when the local store contains
   * more than one category record for the same Product Type.
   */
  const activeCategories = useMemo(() => {
    const byName = new Map();

    for (const category of categories) {
      if (category?.isActive === false) continue;

      const key = normalize(category?.name);
      if (!key || byName.has(key)) continue;

      byName.set(key, category);
    }

    return FIXED_PRODUCT_TYPES
      .map((type) => ({
        ...type,
        record: byName.get(normalize(type.name)) || null,
      }))
      .filter((item) => item.record);
  }, [categories]);

  /*
   * Seed the six standard Product Type attributes when they do not exist.
   * Existing user data is never overwritten.
   */
  useEffect(() => {
    if (!activeCategories.length) return;

    let cancelled = false;

    const setupAllTypes = async () => {
      for (const type of activeCategories) {
        if (cancelled) return;

        const category = type.record;
        const config = PRODUCT_TYPE_ATTRIBUTE_CONFIG[type.name];

        if (!category || !config) continue;
        if (setupInProgress.current.has(category.id)) continue;

        setupInProgress.current.add(category.id);

        try {
          let currentMappings = await categoryAttributeRepo.list({
            categoryId: category.id,
          });

          currentMappings = Array.isArray(currentMappings)
            ? currentMappings
            : [];

          /*
           * Prefer an attribute with the expected name already mapped
           * to this Product Type.
           */
          const matchingAttributes = attributes.filter(
            (item) =>
              normalize(item?.name) === normalize(config.attribute),
          );

          let attribute = matchingAttributes.find((item) =>
            currentMappings.some(
              (mapping) => mapping.attributeId === item.id,
            ),
          );

          /*
           * Do not reuse a Thickness/Size attribute belonging to another
           * Product Type because their values can be different.
           */
          if (!attribute) {
            for (const candidate of matchingAttributes) {
              const allMappings = await categoryAttributeRepo.list({
                attributeId: candidate.id,
              });

              const mappedElsewhere =
                Array.isArray(allMappings) &&
                allMappings.some(
                  (mapping) => mapping.categoryId !== category.id,
                );

              if (!mappedElsewhere) {
                attribute = candidate;
                break;
              }
            }
          }

          if (!attribute) {
            attribute = await createAttribute.mutateAsync({
              name: config.attribute,
              code: makeCode(`${type.code}-${config.attribute}`, "ATTR"),
              dataType: "select",
              isRequired: true,
              isActive: true,
            });
          }

          let mapping = currentMappings.find(
            (item) => item.attributeId === attribute.id,
          );

          if (!mapping) {
            mapping = await upsertCategoryAttribute.mutateAsync({
              categoryId: category.id,
              attributeId: attribute.id,
              isRequired: true,
              sortOrder: 0,
            });
          }

          const existingValues = await attributeValueRepo.list({
            attributeId: attribute.id,
          });

          const activeValues = Array.isArray(existingValues)
            ? existingValues.filter((item) => item?.isActive !== false)
            : [];

          if (!activeValues.length) {
            for (let index = 0; index < config.values.length; index += 1) {
              if (cancelled) return;

              const label = config.values[index];
              const code = makeUniqueCode(label, activeValues);

              await createAttributeValue.mutateAsync({
                attributeId: attribute.id,
                label,
                code,
                sortOrder: index,
                isActive: true,
              });

              activeValues.push({ label, code });
            }
          }
        } catch (error) {
          console.error(
            `Attribute setup failed for ${type.name}`,
            error,
          );
        } finally {
          setupInProgress.current.delete(category.id);
        }
      }
    };

    setupAllTypes();

    return () => {
      cancelled = true;
    };
  }, [
    activeCategories,
    attributes,
    createAttribute,
    createAttributeValue,
    upsertCategoryAttribute,
  ]);

  /*
   * Build the visible table.
   *
   * Standard rows are kept to one primary attribute per fixed Product Type.
   * If a custom attribute is later added through Add Attribute, it is also
   * shown in the table so the newly-created attribute is not hidden.
   */
  useEffect(() => {
    let cancelled = false;

    const loadRows = async () => {
      if (!activeCategories.length) {
        setRows([]);
        return;
      }

      const nextRows = [];

      for (const type of activeCategories) {
        if (cancelled) return;

        const categoryId = type.record.id;
        const config = PRODUCT_TYPE_ATTRIBUTE_CONFIG[type.name];

        const mappingData = await categoryAttributeRepo.list({
          categoryId,
        });

      const mappings = Array.isArray(mappingData) ? mappingData : [];

const categoryRows = [];

/*
 * Show ONLY ONE attribute for each Product Type.
 * The configured standard attribute has priority.
 *
 * Plywood   -> Thickness
 * Laminate  -> Thickness
 * Edge Band -> Thickness
 * WPC       -> Size
 * Fevicol   -> Pack Size
 * Hardware  -> Size
 */
let mappingsToRender = mappings;

if (config) {
  const standardAttributeCode = makeCode(
    `${type.code}-${config.attribute}`,
    "ATTR",
  );

  const standardMapping = mappings.find((mapping) => {
    const attribute = attributes.find(
      (item) => item.id === mapping.attributeId,
    );

    if (!attribute || attribute.isActive === false) return false;

    return (
      attribute.code === standardAttributeCode ||
      normalize(attribute.name) === normalize(config.attribute)
    );
  });

  if (standardMapping) {
    mappingsToRender = [standardMapping];
  } else if (mappings.length) {
    mappingsToRender = [mappings[0]];
  } else {
    mappingsToRender = [];
  }
} else {
  mappingsToRender = mappings.length ? [mappings[0]] : [];
}

for (const mapping of mappingsToRender) {
          const attribute = attributes.find(
            (item) => item.id === mapping.attributeId,
          );

          if (!attribute || attribute.isActive === false) continue;

          const storedValues = await attributeValueRepo.list({
            attributeId: attribute.id,
          });

          const values = Array.isArray(storedValues)
            ? storedValues.filter((item) => item?.isActive !== false)
            : [];

          categoryRows.push({
            id: `${categoryId}-${attribute.id}`,
            categoryId,
            categoryName: type.name,
            attributeId: attribute.id,
            attributeName: attribute.name,
            required: mapping.isRequired ?? true,
            values,
            fallbackValues:
              config &&
              normalize(attribute.name) === normalize(config.attribute)
                ? config.values
                : [],
            isStandard:
              config &&
              normalize(attribute.name) === normalize(config.attribute),
          });
        }

        /*
         * During the first setup render, the mapping can briefly be empty.
         * Keep the standard row visible with fallback values.
         */
        if (!categoryRows.length && config) {
          categoryRows.push({
            id: `${categoryId}-${config.attribute}`,
            categoryId,
            categoryName: type.name,
            attributeId: null,
            attributeName: config.attribute,
            required: true,
            values: [],
            fallbackValues: config.values,
            isStandard: true,
          });
        }

        /*
         * Put the standard attribute first. Any custom attributes added
         * later appear immediately after it.
         */
        categoryRows.sort((a, b) => {
          if (a.isStandard && !b.isStandard) return -1;
          if (!a.isStandard && b.isStandard) return 1;
          return a.attributeName.localeCompare(b.attributeName);
        });

        nextRows.push(...categoryRows);
      }

      if (!cancelled) setRows(nextRows);
    };

    loadRows();

    const timer = window.setTimeout(() => {
      if (!cancelled) loadRows();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeCategories, attributes]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return rows;

    return rows.filter(
      (row) =>
        String(row.categoryName || "").toLowerCase().includes(term) ||
        String(row.attributeName || "").toLowerCase().includes(term) ||
        row.values.some((value) =>
          String(value?.label || "").toLowerCase().includes(term),
        ),
    );
  }, [rows, search]);

  const openValues = (row) => {
    setValuesSheetCategoryId(row.categoryId);
    setValuesSheetAttributeId(row.attributeId || "");
    setValuesSheetOpen(true);
  };

  const closeValues = () => {
    setValuesSheetOpen(false);
    setValuesSheetCategoryId("");
    setValuesSheetAttributeId("");
  };

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title="Attributes"
        description="Manage attributes and the allowed values used for each Product Type."
        actions={
          <Button
            size="sm"
            onClick={() => setNewAttributeOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Attribute
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 pb-24 md:p-6">
       <div className="w-full space-y-4">
          <Card>
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
              <div>
                <h2 className="text-sm font-bold text-ink">
                  Product Attributes
                </h2>

                <p className="mt-0.5 text-[10px] text-muted">
                  Define the attribute and allowed values that users can
                  select while creating products.
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
                  key: "productType",
                  header: "Product Type",
                  sortable: true,
                  render: (row) => (
                    <div>
                      <div className="font-semibold text-ink">
                        {row.categoryName}
                      </div>

                      {row.isStandard ? (
                        <div className="text-2xs text-muted">
                          Standard Product Type
                        </div>
                      ) : (
                        <div className="text-2xs text-muted">
                          Custom Attribute
                        </div>
                      )}
                    </div>
                  ),
                },
              
                {
                  key: "values",
                  header: "Allowed Values",
                  render: (row) => (
                    <AllowedValuesPreview
                      values={
                        row.values.length
                          ? row.values
                          : row.fallbackValues.map((label, index) => ({
                              id: `${row.id}-${index}`,
                              label,
                            }))
                      }
                    />
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  width: 150,
                  align: "right",
                  render: (row) => (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-2xs font-semibold text-ink transition hover:bg-bg"
                      onClick={() => openValues(row)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit Values
                    </button>
                  ),
                },
              ]}
              rows={filteredRows}
              loading={!activeCategories.length || !rows.length}
              emptyTitle="No attributes configured"
              emptyDescription="Your Product Type attributes will appear here."
            />
          </Card>
        </div>
      </div>

      {/* IMPORTANT: Add Attribute form */}
      <NewAttributeSheet
        open={newAttributeOpen}
        onClose={() => setNewAttributeOpen(false)}
        categories={activeCategories}
        attributes={attributes}
      />

      {/* Existing attribute value management */}
      <AttributeValuesSheet
        open={valuesSheetOpen}
        onClose={closeValues}
        categoryId={valuesSheetCategoryId}
        attributeId={valuesSheetAttributeId}
        setCategoryId={setValuesSheetCategoryId}
        categories={activeCategories}
      />
    </div>
  );
}

function AllowedValuesPreview({ values }) {
  if (!values?.length) {
    return <span className="text-2xs text-muted">No values</span>;
  }

  return (
    <div className="max-w-[560px] overflow-x-auto scrollbar-thin">
      <div className="flex w-max min-w-full flex-nowrap items-center gap-1.5 py-0.5">
        {values.map((value) => (
          <span
            key={value.id}
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-line bg-bg px-2.5 py-1 text-2xs font-semibold text-ink"
          >
            {value.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ADD ATTRIBUTE SHEET                                                        */
/* -------------------------------------------------------------------------- */

function NewAttributeSheet({
  open,
  onClose,
  categories,
  attributes,
}) {
  const createAttribute = useCreateAttribute();
  const upsertCategoryAttribute = useUpsertCategoryAttribute();
  const createAttributeValue = useCreateAttributeValue();

  const [categoryId, setCategoryId] = useState("");
  const [attributeName, setAttributeName] = useState("");
  const [valueDraft, setValueDraft] = useState("");
  const [draftValues, setDraftValues] = useState([]);

  const selectedCategory = categories.find(
    (item) => item.record.id === categoryId,
  );

  /*
   * When the Add Attribute sheet opens, select the first Product Type
   * only as an initial UI value. The user can change it.
   */
  useEffect(() => {
    if (!open) return;

    setCategoryId((current) => current || categories[0]?.record?.id || "");
  }, [open, categories]);

  const reset = () => {
    setCategoryId("");
    setAttributeName("");
    setValueDraft("");
    setDraftValues([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addDraftValue = () => {
    const label = valueDraft.trim();

    if (!label) return;

    const exists = draftValues.some(
      (value) => normalize(value) === normalize(label),
    );

    if (exists) {
      toast.error("This value is already added");
      return;
    }

    setDraftValues((current) => [...current, label]);
    setValueDraft("");
  };

  const removeDraftValue = (label) => {
    setDraftValues((current) =>
      current.filter((value) => normalize(value) !== normalize(label)),
    );
  };

  const save = async () => {
  if (!categoryId) {
    toast.error("Please select a Product Type");
    return;
  }

  const selectedType = selectedCategory?.name;
  const config = PRODUCT_TYPE_ATTRIBUTE_CONFIG[selectedType];

  const cleanName =
    config?.attribute || `${selectedType || "Product"} Attribute`;


   

    /*
     * Prevent the same attribute from being mapped twice to one Product Type.
     */
    try {
      const existingMappings = await categoryAttributeRepo.list({
        categoryId,
      });

      const mappingList = Array.isArray(existingMappings)
        ? existingMappings
        : [];

      const mappedAttributeIds = new Set(
        mappingList.map((item) => item.attributeId),
      );

      const duplicate = attributes.find(
        (item) =>
          mappedAttributeIds.has(item.id) &&
          normalize(item.name) === normalize(cleanName),
      );

      if (duplicate) {
        toast.error(
          `${cleanName} is already configured for ${selectedCategory?.name || "this Product Type"}`,
        );
        return;
      }

      /*
       * Create a separate Attribute record even when another Product Type
       * already has an attribute with the same name. This keeps their
       * allowed values independent.
       */
      const attribute = await createAttribute.mutateAsync({
        name: cleanName,
        code: makeUniqueCode(
          `${selectedCategory?.code || "TYPE"}-${cleanName}`,
          attributes,
        ),
        dataType: "select",
        isRequired: true,
        isActive: true,
      });

      await upsertCategoryAttribute.mutateAsync({
        categoryId,
        attributeId: attribute.id,
        isRequired: true,
        sortOrder: 0,
      });

      /*
       * Values are optional. An Attribute can be created first and values
       * can be added later from Edit Values.
       */
      const usedValues = [];

      for (let index = 0; index < draftValues.length; index += 1) {
        const label = draftValues[index];

        await createAttributeValue.mutateAsync({
          attributeId: attribute.id,
          label,
          code: makeUniqueCode(label, usedValues),
          sortOrder: index,
          isActive: true,
        });

        usedValues.push({
          label,
          code: makeUniqueCode(label, usedValues),
        });
      }

      toast.success("Attribute added successfully");
      handleClose();
    } catch (error) {
      toast.error(error?.message || "Could not add attribute");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="New Attribute"
      subtitle="Create an attribute for a Product Type and define its allowed values."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={createAttribute.isPending}
          >
            Cancel
          </Button>

          <Button
            onClick={save}
            disabled={
              !categoryId ||
              !attributeName.trim() ||
              createAttribute.isPending ||
              upsertCategoryAttribute.isPending ||
              createAttributeValue.isPending
            }
          >
            <Check className="h-4 w-4" />
            {createAttribute.isPending ? "Adding…" : "Add Attribute"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Product Type" required>
          <Select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Select product type</option>

            {categories.map((item) => (
              <option
                key={item.record.id}
                value={item.record.id}
              >
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

       

        <div className="border-t border-line pt-5">
          <div className="mb-3">
            

            <p className="mt-0.5 text-[10px] leading-4 text-muted">
              Add the values users should be able to select for this
              attribute. Values are optional.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={valueDraft}
              onChange={(event) => setValueDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addDraftValue();
                }
              }}
              placeholder="Enter value..."
            />

            <Button
              type="button"
              variant="subtle"
              onClick={addDraftValue}
              disabled={!valueDraft.trim()}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-bg/30 p-2.5 scrollbar-thin">
            {draftValues.length ? (
              <div className="flex w-max min-w-full flex-nowrap items-center gap-1.5">
                {draftValues.map((value) => (
                  <div
                    key={value}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-2xs font-semibold text-ink"
                  >
                    <span>{value}</span>

                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted transition hover:bg-bg hover:text-ink"
                      onClick={() => removeDraftValue(value)}
                      aria-label={`Remove ${value}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-1 text-[10px] text-muted">
                No values added yet. You can add them now or later.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 p-3">
          <div className="text-[11px] font-bold text-ink">
            Attribute setup
          </div>

          <p className="mt-0.5 text-[10px] leading-4 text-muted">
            This creates the Attribute, connects it to{" "}
            {selectedCategory?.name || "the selected Product Type"}, and
            stores each allowed value separately.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* EDIT ATTRIBUTE VALUES SHEET                                                */
/* -------------------------------------------------------------------------- */

function AttributeValuesSheet({
  open,
  onClose,
  categoryId,
  attributeId,
  setCategoryId,
  categories,
}) {
  const { data: attributes = [] } = useAttributes();
  const { data: mappings = [] } = useCategoryAttributes(categoryId);

  const createValue = useCreateAttributeValue();
  const updateValue = useUpdateAttributeValue();
  const deleteValue = useDeleteAttributeValue();

  const [valueDraft, setValueDraft] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingLabel, setEditingLabel] = useState("");

  const selectedCategory = categories.find(
    (item) => item.record.id === categoryId,
  );

  /*
   * For the current Product Type, prefer the standard attribute.
   * If the selected row is a custom attribute, the first mapped attribute
   * is used as the context for this sheet.
   */
  const config =
    PRODUCT_TYPE_ATTRIBUTE_CONFIG[selectedCategory?.name] || null;

  const attribute = useMemo(() => {
    if (attributeId) {
      return attributes.find((item) => item.id === attributeId) || null;
    }

    const expectedName = config?.attribute;

    const standardMapping = mappings.find((mapping) => {
      const candidate = attributes.find(
        (attr) => attr.id === mapping.attributeId,
      );

      return (
        candidate &&
        expectedName &&
        normalize(candidate.name) === normalize(expectedName)
      );
    });

    if (standardMapping) {
      return (
        attributes.find(
          (item) => item.id === standardMapping.attributeId,
        ) || null
      );
    }

    const firstMapping = mappings.find((mapping) =>
      attributes.some((attr) => attr.id === mapping.attributeId),
    );

    return firstMapping
      ? attributes.find((item) => item.id === firstMapping.attributeId) ||
          null
      : null;
  }, [attributeId, mappings, attributes, config]);

  const {
    data: storedValues = [],
    isLoading,
  } = useAttributeValues(attribute?.id);

  const activeValues = useMemo(
    () =>
      Array.isArray(storedValues)
        ? storedValues.filter((value) => value?.isActive !== false)
        : [],
    [storedValues],
  );

  useEffect(() => {
    if (!open) {
      setValueDraft("");
      setEditingId("");
      setEditingLabel("");
    }
  }, [open, categoryId]);

  const addValue = async () => {
    const label = valueDraft.trim();

    if (!label || !attribute?.id) return;

    if (
      activeValues.some(
        (value) =>
          normalize(value?.label) === normalize(label),
      )
    ) {
      toast.error("This value already exists");
      return;
    }

    try {
      await createValue.mutateAsync({
        attributeId: attribute.id,
        label,
        code: makeUniqueCode(label, activeValues),
        sortOrder: activeValues.length,
        isActive: true,
      });

      setValueDraft("");
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
          normalize(item?.label) === normalize(label),
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
          attributeId: attribute.id,
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
        attributeId: attribute.id,
      });

      toast.success("Value deleted");
    } catch (error) {
      toast.error(error?.message || "Could not delete value");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Manage Attribute Values"
      subtitle={
        selectedCategory
          ? `${selectedCategory.name} • ${
              attribute?.name || config?.attribute || "Attribute"
            }`
          : "Manage allowed values"
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button onClick={onClose}>
            <Check className="h-4 w-4" />
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Product Type" required>
          <Select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setValueDraft("");
              setEditingId("");
              setEditingLabel("");
            }}
          >
            <option value="">Select product type</option>

            {categories.map((item) => (
              <option
                key={item.record.id}
                value={item.record.id}
              >
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="rounded-xl border border-line bg-bg/50 p-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
            Attribute
          </div>

          <div className="mt-1 text-sm font-bold text-ink">
            {attribute?.name || config?.attribute || "—"}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <div className="mb-3">
            <div className="text-xs font-bold text-ink">
              Allowed Values
            </div>

            <p className="mt-0.5 text-[10px] leading-4 text-muted">
              Add, edit or remove selectable values for this attribute.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={valueDraft}
              onChange={(event) => setValueDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addValue();
                }
              }}
              placeholder="Enter value (e.g. 19mm)"
              disabled={!attribute?.id || isLoading}
              autoFocus
            />

            <Button
              type="button"
              variant="subtle"
              onClick={addValue}
              disabled={
                !valueDraft.trim() ||
                !attribute?.id ||
                createValue.isPending
              }
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-bg/30 p-2.5 scrollbar-thin">
            {activeValues.length ? (
              <div className="flex w-max min-w-full flex-nowrap items-center gap-1.5">
                {activeValues.map((value) => (
                  <div
                    key={value.id}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-2xs font-semibold text-ink"
                  >
                    {editingId === value.id ? (
                      <>
                        <Input
                          value={editingLabel}
                          onChange={(event) =>
                            setEditingLabel(event.target.value)
                          }
                          className="h-6 w-[110px] px-2 text-2xs"
                          autoFocus
                        />

                        <button
                          type="button"
                          className="rounded-full p-1 text-primary-600 hover:bg-primary-500/10"
                          onClick={() => saveValue(value)}
                          aria-label="Save value"
                        >
                          <Check className="h-3 w-3" />
                        </button>

                        <button
                          type="button"
                          className="rounded-full p-1 text-muted hover:bg-bg"
                          onClick={() => {
                            setEditingId("");
                            setEditingLabel("");
                          }}
                          aria-label="Cancel editing"
                        >
                          <X className="h-3 w-3" />
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
                          aria-label={`Edit ${value.label}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>

                        <button
                          type="button"
                          className="rounded-full p-1 text-muted hover:bg-red-50 hover:text-danger"
                          onClick={() => removeValue(value)}
                          aria-label={`Delete ${value.label}`}
                        >
                          <Trash2 className="h-3 w-3" />
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

        <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 p-3">
          <div className="text-[11px] font-bold text-ink">
            Values are stored separately
          </div>

          <p className="mt-0.5 text-[10px] leading-4 text-muted">
            Each allowed value is maintained independently and will be
            available to Product and Billing forms.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

export default AttributesPage;
