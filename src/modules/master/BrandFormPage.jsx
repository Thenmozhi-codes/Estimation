import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, RotateCcw, Save, Tag } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";

import { toast } from "@/lib/toast";
import { toCode } from "@/lib/utils/code";

import {
  useBrands,
  useCategories,
  useCreateBrand,
  useUpdateBrand,
  useAttributes,
  useAttributeValues,
  useCategoryAttributes,
} from "@/hooks/useMasters";

import { useProducts } from "@/hooks/useProducts";

import {
  getFixedProductTypes,
  mapSavedSpecifications,
  mergeSpecifications,
  normalize,
  readSavedUnit,
  resolveBrandCategoryId,
  resolveSpecificationValues,
} from "./brandConfig";

/* ==========================================================================
   HELPERS
========================================================================== */

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function sameId(a, b) {
  return String(a ?? "") === String(b ?? "");
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items || []) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function getAttributeValueLabel(item) {
  return String(
    item?.label ?? item?.name ?? item?.value ?? item?.title ?? "",
  ).trim();
}

function getAttributeName(attribute) {
  return normalize(attribute?.name || attribute?.label || "");
}

const EMPTY_CALCULATION = { wastage: "", markup: "", discount: "" };

/* Unit choices shown in the Brand Form */
const UNIT_OPTIONS = [
  "Nos",
  "Sq.ft",
  "Sq.m",
  "R.ft",
  "C.ft",
  "Kg",
  "Gram",
  "Litre",
  "Box",
  "Packet",
  "Piece",
  "Set",
];

/* ==========================================================================
   BRAND FORM
========================================================================== */

export function BrandFormPage({ open = true, onClose, brandId = null }) {
  const routeParams = useParams();
  const id = brandId || routeParams.id || null;
  const isEdit = Boolean(id);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ---------------------------------------------------------------- DATA */

  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useProducts();
  const { data: rawAttributes = [] } = useAttributes();

  /* --------------------------------------------------------------- STATE */

  const [brandName, setBrandName] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const [specifications, setSpecifications] = useState([]);
  const [newSpecification, setNewSpecification] = useState("");
  const [unit, setUnit] = useState("");
  const [calculation, setCalculation] = useState(EMPTY_CALCULATION);
  const [loaded, setLoaded] = useState(!isEdit);

  const { data: rawCategoryAttributes = [] } =
    useCategoryAttributes(productTypeId);

  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const saving = createBrand.isPending || updateBrand.isPending;

  const attributes = useMemo(() => toArray(rawAttributes), [rawAttributes]);

  const categoryAttributes = useMemo(
    () => toArray(rawCategoryAttributes),
    [rawCategoryAttributes],
  );

  /* -------------------------------------------------------- PRODUCT TYPES */

  const productTypes = useMemo(
    () => getFixedProductTypes(categories),
    [categories],
  );

  const currentBrand = useMemo(() => {
    if (!id) return null;
    return brands.find((brand) => sameId(brand.id, id)) || null;
  }, [brands, id]);

  /* The Product Type this brand was saved with (edit mode) */
  const originalTypeId = useMemo(
    () =>
      currentBrand
        ? resolveBrandCategoryId(currentBrand, products, categories)
        : "",
    [currentBrand, products, categories],
  );

  const savedSpecifications = useMemo(
    () => mapSavedSpecifications(currentBrand),
    [currentBrand],
  );

  const selectedProductType = useMemo(
    () =>
      productTypes.find((type) => sameId(type.categoryId, productTypeId)) ||
      null,
    [productTypes, productTypeId],
  );

  /* ------------------------------------------- MASTER SPECIFICATION VALUES */

  const mappedAttributes = useMemo(() => {
    if (!productTypeId) return [];

    const mapped = categoryAttributes
      .map((mapping) => ({
        mapping,
        attribute: attributes.find((item) => sameId(item.id, mapping.attributeId)),
      }))
      .filter((item) => Boolean(item.attribute))
      .sort(
        (a, b) =>
          Number(a.mapping?.sortOrder ?? 0) - Number(b.mapping?.sortOrder ?? 0),
      );

    return uniqueBy(mapped, (item) => String(item.attribute?.id));
  }, [categoryAttributes, attributes, productTypeId]);

  /* Thickness -> Pack Size -> Size -> Specification -> first mapped */
  const primarySpecification = useMemo(() => {
    if (!mappedAttributes.length) return null;

    for (const preferred of ["thickness", "pack size", "size", "specification"]) {
      const found = mappedAttributes.find(
        (item) => getAttributeName(item.attribute) === preferred,
      );
      if (found) return found.attribute;
    }

    return mappedAttributes[0]?.attribute || null;
  }, [mappedAttributes]);

  const { data: rawSpecificationValues } = useAttributeValues(
    primarySpecification?.id || "",
  );

  /*
   * Values for this Product Type:
   *   Plywood / Laminate / Edge Band / WPC / Fevicol -> their own fixed list
   *   Timber / Beading / Laminated Board / HMR Board / Door
   *       -> Master -> Specifications, or the default list when the
   *          master has nothing yet (so the form is never empty)
   *
   * Kept as a STABLE array (rebuilt only when the values change). A new
   * array on every render used to make the auto-fill re-add rows the user
   * had just removed.
   */
  const specificationKey = useMemo(() => {
    const master = toArray(rawSpecificationValues)
      .filter((item) => item?.isActive !== false)
      .map(getAttributeValueLabel)
      .filter(Boolean);

    return JSON.stringify(
      resolveSpecificationValues(selectedProductType?.label, master),
    );
  }, [rawSpecificationValues, selectedProductType]);

  const specificationValues = useMemo(
    () => JSON.parse(specificationKey),
    [specificationKey],
  );

  /* ------------------------------------------------------- OPEN / RESET */

  useEffect(() => {
    if (!open) return;

    setNewSpecification("");

    if (!isEdit) {
      setBrandName("");
      setProductTypeId("");
      setSpecifications([]);
      setUnit("");
      setCalculation(EMPTY_CALCULATION);
      setLoaded(true);
      return;
    }

    setLoaded(false);
  }, [open, id, isEdit]);

  /* -------------------------------------------------- LOAD EXISTING BRAND */

  useEffect(() => {
    if (!open || !isEdit || loaded || !currentBrand) return;

    setBrandName(currentBrand.name || "");
    setProductTypeId(originalTypeId);
    setSpecifications(savedSpecifications);
    setUnit(readSavedUnit(currentBrand));

    setCalculation(
      currentBrand.calculation
        ? {
            wastage: currentBrand.calculation?.wastage ?? "",
            markup: currentBrand.calculation?.markup ?? "",
            discount: currentBrand.calculation?.discount ?? "",
          }
        : EMPTY_CALCULATION,
    );

    setLoaded(true);
  }, [open, isEdit, loaded, currentBrand, originalTypeId, savedSpecifications]);

  /* ---------------------------------------------- AUTO-FILL SPECIFICATIONS */

  useEffect(() => {
    if (!open || !loaded) return;

    if (!productTypeId) {
      setSpecifications((previous) => (previous.length ? [] : previous));
      return;
    }

    /*
     * An existing brand keeps its saved specifications while it is still on
     * its original Product Type. If the Product Type is changed, the new
     * type's values are loaded instead.
     */
    if (
      isEdit &&
      savedSpecifications.length > 0 &&
      sameId(productTypeId, originalTypeId)
    ) {
      return;
    }

    if (!specificationValues.length) return;

    setSpecifications((previous) =>
      mergeSpecifications(previous, specificationValues),
    );
  }, [
    open,
    loaded,
    productTypeId,
    specificationValues,
    isEdit,
    originalTypeId,
    savedSpecifications,
  ]);

  /* ----------------------------------------------------------- HANDLERS */

  const handleProductTypeChange = (event) => {
    const nextType = event.target.value;

    setProductTypeId(nextType);
    setNewSpecification("");

    /* going back to the saved type restores what was saved */
    if (isEdit && nextType && sameId(nextType, originalTypeId)) {
      setSpecifications(savedSpecifications);
      setUnit(readSavedUnit(currentBrand));
      return;
    }

    /* specifications and unit belong to the old Product Type */
    setSpecifications([]);
    setUnit("");
  };

  const removeSpecification = (index) =>
    setSpecifications((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );

  const updateSpecificationPrice = (index, price) =>
    setSpecifications((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, price } : item,
      ),
    );

  /* add a specification by hand */
  const addSpecification = () => {
    const label = newSpecification.trim();

    if (!label) return;

    if (label.length > 40) {
      toast.error("Specification is too long (max 40 characters)");
      return;
    }

    if (
      specifications.some(
        (item) => normalize(item.specification) === normalize(label),
      )
    ) {
      toast.error(`"${label}" is already in the list`);
      return;
    }

    setSpecifications((previous) => [
      ...previous,
      { specification: label, price: "", manual: true },
    ]);
    setNewSpecification("");
  };

  /* bring back removed default values; existing rows and prices are kept */
  const restoreDefaults = () =>
    setSpecifications((previous) => {
      const have = new Set(previous.map((item) => normalize(item.specification)));

      const missing = specificationValues
        .filter((value) => !have.has(normalize(value)))
        .map((value) => ({ specification: value, price: "" }));

      return missing.length ? [...previous, ...missing] : previous;
    });

  /* ---------------------------------------------------------- VALIDATION */

  const validate = () => {
    const cleanName = brandName.trim();

    if (!cleanName) return "Brand name is required";
    if (!productTypeId) return "Please select a Product Type";

    if (!productTypes.some((type) => sameId(type.categoryId, productTypeId))) {
      return "Please select a valid Product Type";
    }

    if (!specifications.length) {
      return "Add at least one specification";
    }

    const invalidPrice = specifications.some(
      (item) =>
        item.price !== "" &&
        (Number.isNaN(Number(item.price)) || Number(item.price) < 0),
    );

    if (invalidPrice) return "Please enter valid specification prices";

    const duplicate = brands.find((brand) => {
      if (sameId(brand.id, id)) return false;
      if (brand.isActive === false) return false;

      const existingTypeId = resolveBrandCategoryId(brand, products, categories);

      return (
        normalize(brand.name) === normalize(cleanName) &&
        sameId(existingTypeId, productTypeId)
      );
    });

    if (duplicate) {
      return `"${cleanName}" already exists for this Product Type`;
    }

    return null;
  };

  /* ---------------------------------------------------------------- SAVE */

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }

    navigate("/master/brands");
  };

  const handleSave = async () => {
    if (saving) return;

    const error = validate();

    if (error) {
      toast.error(error);
      return;
    }

    const cleanName = brandName.trim();

    const toNumberOrNull = (value) =>
      value === "" || value === null || value === undefined
        ? null
        : Number(value);

    const payload = {
      name: cleanName,
      code: toCode(cleanName),
      categoryId: productTypeId,
      isActive: true,

      specifications: specifications.map((item) => ({
        specification: item.specification,
        price: toNumberOrNull(item.price),
      })),

      materialDetails: {
        category: selectedProductType?.label || "",
        brand: cleanName,
        unit: String(unit || "").trim(),
      },

      calculation: {
        wastage: toNumberOrNull(calculation.wastage),
        markup: toNumberOrNull(calculation.markup),
        discount: toNumberOrNull(calculation.discount),
      },
    };

    try {
      if (!isEdit) {
        await createBrand.mutateAsync(payload);
        toast.success("Brand created");
      } else {
        await updateBrand.mutateAsync({ id, patch: payload });
        toast.success("Brand updated");
      }

      await queryClient.invalidateQueries({ queryKey: ["brands"] });

      close();
    } catch (err) {
      console.error("Brand save failed:", err);
      toast.error(err?.message || "Could not save brand");
    }
  };

  /* --------------------------------------------------------------- VIEW */

  /* a saved Unit that is not in the list is still shown */
  const unitOptions =
    unit && !UNIT_OPTIONS.includes(unit) ? [unit, ...UNIT_OPTIONS] : UNIT_OPTIONS;

  const canRestoreDefaults =
    specificationValues.length > 0 &&
    specificationValues.some(
      (value) =>
        !specifications.some(
          (item) => normalize(item.specification) === normalize(value),
        ),
    );

  const brandMissing = isEdit && !brandsLoading && !currentBrand;

  return (
    <Sheet
      open={open}
      onClose={close}
      title={isEdit ? "Edit Brand" : "Add Brand"}
      subtitle={
        isEdit
          ? "Update brand, specifications, unit and pricing."
          : "Create a brand with specifications and unit for quotations."
      }
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>

          <Button onClick={handleSave} disabled={saving || !loaded}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Brand"}
          </Button>
        </>
      }
    >
      {brandMissing ? (
        <div className="flex min-h-[220px] items-center justify-center text-sm font-semibold text-muted">
          This brand could not be found. It may have been deleted.
        </div>
      ) : !loaded ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="text-sm font-semibold text-muted">Loading brand…</div>
        </div>
      ) : (
        <form
          className="space-y-5 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          {/* 1. PRODUCT TYPE */}
          <div className="rounded-xl border border-line bg-bg/50 p-4">
            <Field
              label="Product Type"
              required
              hint="Choose the Product Type this brand belongs to."
            >
              <Select value={productTypeId} onChange={handleProductTypeChange}>
                <option value="">Select Product Type</option>

                {productTypes.map((type) => (
                  <option key={type.categoryId} value={type.categoryId}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* 2. BRAND NAME */}
          <div className="rounded-xl border border-line bg-bg/50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                <Tag className="h-4 w-4 text-primary-500" />
              </div>

              <div>
                <div className="text-sm font-bold text-ink">Brand Details</div>
                <div className="text-[0.75rem] text-muted">
                  Enter the brand name for this Product Type.
                </div>
              </div>
            </div>

            <Field label="Brand Name" required>
              <Input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="e.g. Sharon Sovereign"
                autoFocus
                maxLength={100}
              />
            </Field>
          </div>

          {/* 3. SPECIFICATIONS & PRICE */}
          {productTypeId && (
            <div className="rounded-xl border border-line bg-bg/50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-ink">
                    Specifications & Price
                  </div>

                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    Values load automatically for this Product Type. Enter a
                    price, remove what you don't need, or add your own.
                  </p>
                </div>

                <div className="shrink-0 rounded-lg bg-primary-500/10 px-2.5 py-1 text-[0.6875rem] font-bold text-primary-600">
                  {specifications.length} values
                </div>
              </div>

              {specifications.length > 0 && (
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-3 px-1">
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
                    Specification
                  </div>
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
                    Price
                  </div>
                  <div />
                </div>
              )}

              <div className="space-y-3">
                {specifications.map((item, index) => (
                  <div
                    key={`${item.specification}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-3"
                  >
                    <Input
                      value={item.specification}
                      readOnly
                      className="h-9 bg-bg"
                    />

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(event) =>
                        updateSpecificationPrice(index, event.target.value)
                      }
                      placeholder="Enter price"
                      className="h-9 min-w-0"
                    />

                    <button
                      type="button"
                      onClick={() => removeSpecification(index)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 transition hover:bg-red-500/10"
                      title="Remove Specification"
                      aria-label={`Remove ${item.specification}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {specifications.length === 0 && (
                <div className="rounded-lg border border-dashed border-line px-3 py-3 text-xs text-muted">
                  No specifications yet. Add at least one below so this brand
                  can be used in quotations.
                </div>
              )}

              {/* add your own */}
              <div className="mt-4 flex items-center gap-2">
                <Input
                  value={newSpecification}
                  onChange={(event) => setNewSpecification(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSpecification();
                    }
                  }}
                  placeholder="Add specification, e.g. 25mm"
                  className="h-9 min-w-0 flex-1"
                  maxLength={40}
                />

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addSpecification}
                  disabled={!newSpecification.trim()}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {canRestoreDefaults && (
                <button
                  type="button"
                  onClick={restoreDefaults}
                  className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] font-bold text-primary-600 hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore removed values
                </button>
              )}
            </div>
          )}

          {/* 4. UNIT */}
          {productTypeId && (
            <div className="rounded-xl border border-line bg-bg/50 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                  <Package className="h-4 w-4 text-primary-500" />
                </div>

                <div>
                  <div className="text-sm font-bold text-ink">Unit</div>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    Configure the default unit used for this brand in quotations.
                  </p>
                </div>
              </div>

              <Field label="Unit" hint="Select the unit used for this brand.">
                <Select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                >
                  <option value="">Select Unit</option>

                  {unitOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {/* SUMMARY */}
          {productTypeId && (
            <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 p-4">
              <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-primary-600">
                Brand Configuration
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-[0.6875rem] uppercase tracking-wide text-muted">
                    Product Type
                  </div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {selectedProductType?.label}
                  </div>
                </div>

                <div>
                  <div className="text-[0.6875rem] uppercase tracking-wide text-muted">
                    Specifications
                  </div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {specifications.length}
                  </div>
                </div>

                <div>
                  <div className="text-[0.6875rem] uppercase tracking-wide text-muted">
                    Unit
                  </div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {unit || "Not configured"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}

export default BrandFormPage;
