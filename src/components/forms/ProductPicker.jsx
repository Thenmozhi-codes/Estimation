import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Package, Plus, X } from "lucide-react";

import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { mockStore } from "@/lib/store/mockStore";
import { useQueryClient } from "@tanstack/react-query";
import { newId } from "@/lib/utils/id";
import { toCode } from "@/lib/utils/code";

/* ==========================================================================
   PRODUCT TYPES
   ========================================================================== */

const PRODUCT_TYPES = [
  { key: "Plywood", label: "Plywood", aliases: ["Plywood", "PLYWOOD", "ply"] },
  { key: "Laminate", label: "Laminate", aliases: ["Laminate", "LAMINATE", "lam"] },
  {
    key: "Edge Band",
    label: "Edge Band",
    aliases: ["Edge Band", "EdgeBand", "EDGE_BAND", "Edgeband"],
  },
  { key: "WPC", label: "WPC", aliases: ["WPC"] },
  { key: "Adhesive", label: "Fevicol", aliases: ["Adhesive", "Fevicol", "FEVICOL"] },
];

/* ==========================================================================
   MEASUREMENT BY PRODUCT TYPE

   Which fields are asked and how the billing quantity is calculated.
   Change a type here and the popup follows automatically.

   fields : any of "length" | "width" | "height"  (all in feet)
   unit   : billing unit when the measurement is filled
   label  : name of the calculated result
   Quantity = product of the fields × Pcs.
   ========================================================================== */

const MEASURE_LABELS = {
  length: "Length (ft)",
  width: "Width (ft)",
  height: "Height (ft)",
};

const MEASURE_NAMES = {
  length: "Length",
  width: "Width",
  height: "Height",
};

const MEASUREMENT_BY_TYPE = {
  Plywood: { fields: ["length", "width"], unit: "sq.ft", label: "Area" },
  Laminate: { fields: ["length", "width"], unit: "sq.ft", label: "Area" },
  "Edge Band": { fields: ["length"], unit: "rft", label: "Length" },
  WPC: {
    fields: ["length", "width", "height"],
    unit: "cu.ft",
    label: "Volume",
  },
  Adhesive: { fields: [], unit: "pcs", label: "" },
};

const NO_MEASUREMENT = { fields: [], unit: "pcs", label: "" };

/* true = L / W / H shown for the product type must be filled before adding */
const MEASUREMENT_REQUIRED = true;

/* ==========================================================================
   HELPERS
   ========================================================================== */

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function sameId(a, b) {
  return String(a ?? "") === String(b ?? "");
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function calcMeasurement(typeKey, values, pcs) {
  const config = MEASUREMENT_BY_TYPE[typeKey] || NO_MEASUREMENT;

  const numbers = config.fields.map((field) => safeNumber(values?.[field]));

  const active = config.fields.length > 0 && numbers.every((n) => n > 0);

  const qty = active
    ? numbers.reduce((product, n) => product * n, 1) * pcs
    : 0;

  return { ...config, active, qty };
}

function formatMeasureQty(measure) {
  return measure.qty.toFixed(measure.unit === "cu.ft" ? 3 : 2);
}

function getTypeConfig(type) {
  return PRODUCT_TYPES.find((item) => item.key === type) || null;
}

function brandIdMatches(product, brandId) {
  return (
    sameId(product?.brandId, brandId) ||
    sameId(product?.brandID, brandId) ||
    sameId(product?.brand?.id, brandId)
  );
}

/* ==========================================================================
   PRODUCT TYPE MATCHING
   ========================================================================== */

function matchesType(value, typeConfig) {
  if (!value || !typeConfig) return false;
  const normalizedValue = normalize(value);
  return typeConfig.aliases.some((alias) => normalize(alias) === normalizedValue);
}

function categoryMatchesType(category, typeConfig) {
  if (!category || !typeConfig) return false;

  const values = [
    category.name,
    category.label,
    category.slug,
    category.code,
    category.key,
    category.type,
  ];

  return values.some((value) => matchesType(value, typeConfig));
}

function legacyBrandMatchesType(brand, typeConfig) {
  const name = normalize(brand?.name);
  if (!name || !typeConfig) return false;

  if (typeConfig.key === "Plywood") {
    return (
      name.includes("ply") ||
      name.includes("plywood") ||
      name.includes("mikasa") ||
      name === "sharongold" ||
      name === "sharonsovereign"
    );
  }
  if (typeConfig.key === "Laminate") return name.includes("laminate");
  if (typeConfig.key === "Edge Band") {
    return name.includes("edgeband") || name.includes("edging");
  }
  if (typeConfig.key === "WPC") return name.includes("wpc");
  if (typeConfig.key === "Adhesive") return name.includes("fevicol");

  return false;
}

function brandMatchesType({ brand, typeConfig, categories, products }) {
  if (!brand || brand.isActive === false || !typeConfig) return false;

  /* 1. PRIMARY BRAND MASTER MAPPING */
  const categoryIds = [
    brand.categoryId,
    brand.productTypeId,
    brand.productCategoryId,
  ].filter(Boolean);

  if (categoryIds.length) {
    const category = categories.find((item) =>
      categoryIds.some((id) => sameId(id, item?.id)),
    );
    if (category) return categoryMatchesType(category, typeConfig);
  }

  /* 2. DIRECT PRODUCT TYPE */
  const directValues = [
    brand.productType,
    brand.productTypeName,
    brand.category,
    brand.categoryName,
    brand.type,
  ];

  if (directValues.some((value) => matchesType(value, typeConfig))) return true;

  /* 3. PRODUCT MASTER RELATIONSHIP */
  const brandProducts = products.filter((product) =>
    brandIdMatches(product, brand.id),
  );

  if (brandProducts.length) {
    return brandProducts.some((product) => {
      const category = categories.find((item) =>
        sameId(item?.id, product?.categoryId),
      );
      return (
        categoryMatchesType(category, typeConfig) ||
        matchesType(product?.categoryName, typeConfig) ||
        matchesType(product?.productType, typeConfig)
      );
    });
  }

  /* 4. LEGACY FALLBACK */
  return legacyBrandMatchesType(brand, typeConfig);
}

/* ==========================================================================
   BRAND MASTER SPECIFICATIONS
   ========================================================================== */

function normalizeBrandSpecifications(brand) {
  const raw = brand?.specifications ?? brand?.specs ?? brand?.attributes ?? [];
  const rows = [];

  if (Array.isArray(raw)) {
    raw.forEach((item, index) => {
      if (typeof item === "string") {
        const label = item.trim();
        if (!label) return;
        rows.push({ id: `brand-spec-${index}`, label, price: 0 });
        return;
      }

      if (item && typeof item === "object") {
        const label = String(
          item.specification ??
            item.spec ??
            item.name ??
            item.label ??
            item.value ??
            "",
        ).trim();

        if (!label) return;

        const price = safeNumber(
          item.price ??
            item.defaultPrice ??
            item.sellingPrice ??
            item.amount ??
            0,
        );

        rows.push({ id: item.id || `brand-spec-${index}`, label, price });
      }
    });
  } else if (raw && typeof raw === "object") {
    Object.entries(raw).forEach(([label, value], index) => {
      const cleanLabel = String(label).trim();
      if (!cleanLabel) return;

      const price =
        value && typeof value === "object"
          ? safeNumber(
              value.price ??
                value.defaultPrice ??
                value.sellingPrice ??
                value.amount ??
                0,
            )
          : safeNumber(value);

      rows.push({ id: `brand-spec-${index}`, label: cleanLabel, price });
    });
  }

  /* Deduplicate — keep the row that has a price */
  const map = new Map();

  rows.forEach((row) => {
    const key = normalize(row.label);
    if (!key) return;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      return;
    }

    if (safeNumber(existing.price) <= 0 && safeNumber(row.price) > 0) {
      map.set(key, { ...existing, price: safeNumber(row.price) });
    }
  });

  return Array.from(map.values());
}

/* ==========================================================================
   VARIANT HELPERS
   ========================================================================== */

function getVariantAttributes({
  variant,
  variantAttributes,
  attributes,
  attributeValues,
}) {
  const rows = variantAttributes.filter((item) =>
    sameId(item?.variantId, variant?.id),
  );

  const result = {};

  rows.forEach((row) => {
    const attribute = attributes.find((item) =>
      sameId(item?.id, row?.attributeId),
    );
    if (!attribute) return;

    const value = attributeValues.find((item) =>
      sameId(item?.id, row?.attributeValueId),
    );

    result[attribute.name] = value?.label || row?.rawValue || "";
  });

  /* Older data may keep attributes directly on the variant */
  if (variant?.attributes && typeof variant.attributes === "object") {
    Object.assign(result, variant.attributes);
  }

  return result;
}

function getVariantPrice({ variantId, prices }) {
  const rows = prices.filter((item) => sameId(item?.variantId, variantId));

  const selling = rows.find((item) => item?.priceType === "selling");
  const retail = rows.find((item) => item?.priceType === "retail");
  const wholesale = rows.find((item) => item?.priceType === "wholesale");

  return safeNumber(selling?.amount ?? retail?.amount ?? wholesale?.amount ?? 0);
}

function variantMatchesSpecification(variant, specification) {
  if (!variant || !specification) return false;

  const target = normalize(specification.label);
  if (!target) return false;

  const values = [variant.sku, variant.name, variant.specification, variant.spec];

  Object.entries(variant.attributes || {}).forEach(([name, value]) => {
    values.push(name);
    values.push(value);
    values.push(`${name} ${value}`);
  });

  return values.some((value) => {
    const normalized = normalize(value);
    if (!normalized) return false;
    return (
      normalized === target ||
      normalized.includes(target) ||
      target.includes(normalized)
    );
  });
}

/* ==========================================================================
   PRODUCT PICKER
   ========================================================================== */

export function ProductPicker({
  open,
  onClose,
  onSelect,
  initialItem = null,
  mode = "add",
}) {
  const [selectedType, setSelectedType] = useState("");
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSpecification, setSelectedSpecification] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [query, setQuery] = useState("");
  const [customSpecification, setCustomSpecification] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const queryClient = useQueryClient();

  /* MEASUREMENT STATE */
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [pcs, setPcs] = useState(1);

  const inputRef = useRef(null);

  /* READ STORE */
  const db = mockStore.get() || {};

  const brands = toArray(db.brands);
  const products = toArray(db.products);
  const variants = toArray(db.variants);
  const variantAttributes = toArray(db.variantAttributes);
  const attributes = toArray(db.attributes);
  const attributeValues = toArray(db.attributeValues);
  const prices = toArray(db.prices);
  const stock = toArray(db.stock);
  const categories = toArray(db.categories);

  function resetDimensions() {
    setLength("");
    setWidth("");
    setHeight("");
  }

  /* CLOSE ON ESCAPE */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /* RESET WHEN OPENED */
  useEffect(() => {
    if (!open) return;

    setSelectedType("");
    setSelectedBrand(null);
    setSelectedProduct(null);
    setSelectedSpecification(null);
    setSelectedVariant(null);
    setQuery("");
    setCustomSpecification("");
    setCustomPrice("");
    setLength("");
    setWidth("");
    setHeight("");
    setPcs(1);

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => clearTimeout(timer);
  }, [open]);

  /* EDIT MODE — prefill from the existing line */
  useEffect(() => {
    if (!open || !initialItem) return;

    const requestedType = String(initialItem.productType || "").trim();

    const typeConfig =
      PRODUCT_TYPES.find(
        (type) =>
          normalize(type.label) === normalize(requestedType) ||
          type.aliases.some(
            (alias) => normalize(alias) === normalize(requestedType),
          ),
      ) || null;

    if (!typeConfig) return;

    const brand =
      brands.find((item) => sameId(item?.id, initialItem?.brandId)) ||
      brands.find(
        (item) => normalize(item?.name) === normalize(initialItem?.brandName),
      ) ||
      null;

    if (!brand) return;

    const product =
      products.find((item) => sameId(item?.id, initialItem?.productId)) ||
      products.find((item) => brandIdMatches(item, brand.id)) ||
      ensureProductForBrand(brand, categories, typeConfig.key);

    if (!product) return;

    setSelectedType(typeConfig.key);
    setSelectedBrand(brand);
    setSelectedProduct(product);
    setSelectedVariant(initialItem?.matchedVariant || initialItem?.variant || null);
    setQuery("");

    setLength(
      initialItem?.length !== undefined && initialItem?.length !== null
        ? String(initialItem.length)
        : "",
    );
    setWidth(
      initialItem?.width !== undefined && initialItem?.width !== null
        ? String(initialItem.width)
        : "",
    );
    setHeight(
      initialItem?.height !== undefined && initialItem?.height !== null
        ? String(initialItem.height)
        : "",
    );
    setPcs(Math.max(1, safeNumber(initialItem?.pcs) || 1));

    const wantedSpecification = String(
      initialItem?.selectedSpecification || "",
    ).trim();

    if (!wantedSpecification) return;

    const currentSpecifications = normalizeBrandSpecifications(brand);

    const matchingSpecification =
      currentSpecifications.find(
        (item) => normalize(item?.label) === normalize(wantedSpecification),
      ) ||
      currentSpecifications.find((item) =>
        normalize(item?.label).includes(normalize(wantedSpecification)),
      ) ||
      null;

    if (matchingSpecification) {
      setSelectedSpecification(matchingSpecification);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItem]);

  /* AVAILABLE BRANDS */
  const availableBrands = useMemo(() => {
    const typeConfig = getTypeConfig(selectedType);
    if (!typeConfig) return [];

    const activeBrands = brands.filter(
      (brand) => brand?.id && brand?.isActive !== false,
    );

    const matchingBrands = activeBrands.filter((brand) =>
      brandMatchesType({ brand, typeConfig, categories, products }),
    );

    const unique = uniqueBy(matchingBrands, (brand) => String(brand.id));

    const search = normalize(query);
    if (!search) return unique;

    return unique.filter(
      (brand) =>
        normalize(brand.name).includes(search) ||
        normalize(brand.code).includes(search),
    );
  }, [brands, categories, products, selectedType, query]);

  /*
   * Brand and Product are treated as the same business item in quotation.
   * Creates a Product for the brand if none exists yet.
   */
  function ensureProductForBrand(
    brand,
    categoryList = categories,
    typeKey = selectedType,
  ) {
    if (!brand?.id) return null;

    const latestDb = mockStore.get() || {};
    const currentProducts = toArray(latestDb.products);

    const existing = currentProducts.find(
      (product) => product?.status !== "inactive" && brandIdMatches(product, brand.id),
    );

    if (existing) return existing;

    const categoryId =
      brand.categoryId ||
      brand.productTypeId ||
      brand.productCategoryId ||
      categoryList.find((category) =>
        categoryMatchesType(category, getTypeConfig(typeKey)),
      )?.id ||
      null;

    const now = new Date().toISOString();

    const product = {
      id: newId(),
      companyId: latestDb.companies?.[0]?.id || null,
      name: brand.name, // Product name = Brand name
      sku: brand.code || toCode(brand.name) || `BR-${brand.id}`,
      categoryId,
      brandId: brand.id,
      description: "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    mockStore.set({
      ...latestDb,
      products: [...currentProducts, product],
    });

    return product;
  }

  /* EXISTING VARIANTS */
  const productVariants = useMemo(() => {
    if (!selectedProduct) return [];

    return variants
      .filter(
        (variant) =>
          sameId(variant?.productId, selectedProduct.id) &&
          variant?.status !== "inactive",
      )
      .map((variant) => {
        const attrs = getVariantAttributes({
          variant,
          variantAttributes,
          attributes,
          attributeValues,
        });

        const variantPrice = getVariantPrice({ variantId: variant.id, prices });

        const stockRow = stock.find((item) => sameId(item?.variantId, variant.id));

        return {
          ...variant,
          attributes: attrs,
          price: variantPrice,
          stock: safeNumber(stockRow?.quantity),
        };
      });
  }, [
    selectedProduct,
    variants,
    variantAttributes,
    attributes,
    attributeValues,
    prices,
    stock,
  ]);

  /* BRAND MASTER SPECIFICATIONS */
  const brandSpecifications = useMemo(() => {
    if (!selectedBrand) return [];
    return normalizeBrandSpecifications(selectedBrand);
  }, [selectedBrand]);

  /*
   * FINAL SPECIFICATIONS
   * Priority: 1. Brand Master  2. Existing product variants
   */
  const specifications = useMemo(() => {
    if (!selectedProduct) return [];

    if (brandSpecifications.length) {
      return brandSpecifications.map((specification) => {
        const matchingVariant = productVariants.find((variant) =>
          variantMatchesSpecification(variant, specification),
        );

        return {
          ...specification,
          matchedVariant: matchingVariant || null,
          variantPrice: safeNumber(matchingVariant?.price),
        };
      });
    }

    return productVariants.map((variant) => {
      const attrs = variant.attributes || {};

      const entries = Object.entries(attrs).filter(
        ([name]) => name !== "Brand" && name !== "Unit",
      );

      const label = entries.length
        ? entries.map(([, value]) => value).join(" • ")
        : "Default variant";

      return {
        id: variant.id,
        label,
        price: safeNumber(variant.price),
        matchedVariant: variant,
        variantPrice: safeNumber(variant.price),
      };
    });
  }, [selectedProduct, brandSpecifications, productVariants]);

  /*
   * EDIT MODE — select the specification of the line being edited.
   *
   * The specification list above is built AFTER the brand is chosen, and for
   * brands without Brand Master specifications it comes from the product's
   * variants. The prefill effect further up only looks at Brand Master, so for
   * those brands nothing was selected (no tick, Total "—"). This matches
   * against the FINAL list: by label first, then by the saved variant.
   *
   * NOTE: this is a hook, so it must stay above the `if (!open) return null`.
   */
  useEffect(() => {
    if (!open || !initialItem) return;
    if (selectedSpecification || !specifications.length) return;
    if (!selectedBrand) return;

    /* only for the brand the line was saved with, never after the user
       switches to another brand */
    const sameBrand =
      sameId(selectedBrand.id, initialItem.brandId) ||
      normalize(selectedBrand.name) === normalize(initialItem.brandName);

    if (!sameBrand) return;

    const wanted = normalize(initialItem.selectedSpecification);

    const byLabel = wanted
      ? specifications.find((item) => normalize(item.label) === wanted) ||
        specifications.find((item) => {
          const label = normalize(item.label);
          return label && (label.includes(wanted) || wanted.includes(label));
        })
      : null;

    const byVariant = initialItem.variantId
      ? specifications.find(
          (item) =>
            sameId(item.matchedVariant?.id, initialItem.variantId) ||
            sameId(item.id, initialItem.variantId),
        )
      : null;

    const match = byLabel || byVariant || null;

    if (match) {
      setSelectedSpecification(match);
      setSelectedVariant(match.matchedVariant || null);
    }
  }, [open, initialItem, selectedBrand, specifications, selectedSpecification]);

  /* CLOSED */
  if (!open) return null;

  const typeConfig = getTypeConfig(selectedType);

  /* Add a document-specific specification and persist it on the selected Brand Master. */
  async function handleAddCustomSpecification() {
    const label = String(customSpecification || "").trim();
    if (!selectedBrand?.id || !label) return;

    const existingRows = normalizeBrandSpecifications(selectedBrand);
    const duplicate = existingRows.find(
      (row) => normalize(row.label) === normalize(label),
    );

    if (duplicate) {
      setSelectedSpecification(duplicate);
      setCustomSpecification("");
      setCustomPrice("");
      return;
    }

    const price = safeNumber(customPrice);
    const nextSpecifications = [
      ...existingRows.map((row) => ({
        specification: row.label,
        price: safeNumber(row.price),
      })),
      { specification: label, price },
    ];

    mockStore.update("brands", selectedBrand.id, {
      specifications: nextSpecifications,
    });
    setSelectedBrand((current) =>
      current
        ? { ...current, specifications: nextSpecifications }
        : current,
    );

    const created = {
      id: `brand-spec-${selectedBrand.id}-${normalize(label).replace(/[^a-z0-9]+/g, "-")}`,
      label,
      price,
      matchedVariant: null,
      variantPrice: 0,
    };

    setSelectedSpecification(created);
    setCustomSpecification("");
    setCustomPrice("");
    queryClient.invalidateQueries({ queryKey: ["brands"] });
  }

  /* FINAL ADD */
  function handleAddToLine() {
    if (!selectedProduct?.id || !selectedSpecification) return;

    const variant =
      selectedSpecification.matchedVariant ||
      selectedVariant ||
      productVariants.find((item) => item.isDefault) ||
      productVariants[0] ||
      null;

    const legacyMaterialDetails =
      selectedBrand?.materialDetails ||
      selectedBrand?.materialData ||
      selectedBrand?.details ||
      {};

    /*
     * The selected Specification is included in the attribute values, so it is
     * persisted with the variant and comes back in attributesSnapshot when the
     * document is opened for Edit.
     */
    const attributeValuesPayload = {
      ...(variant?.attributes || {}),
      Unit:
        variant?.attributes?.Unit ||
        legacyMaterialDetails?.unit ||
        legacyMaterialDetails?.uom ||
        legacyMaterialDetails?.unitName ||
        "",
      Specification: selectedSpecification.label,
    };

    /* PRICE: Brand Master first, then variant */
    const brandPrice = safeNumber(selectedSpecification.price);
    const variantPrice = safeNumber(variant?.price);
    const rate = brandPrice > 0 ? brandPrice : variantPrice;

    /* MEASUREMENT (fields depend on the product type) */
    const numericPcs = Math.max(1, safeNumber(pcs) || 1);
    const dims = {
      length: safeNumber(length),
      width: safeNumber(width),
      height: safeNumber(height),
    };
    const measure = calcMeasurement(selectedType, dims, numericPcs);

    if (MEASUREMENT_REQUIRED && measure.fields.length > 0 && !measure.active) {
      return;
    }

    onSelect({
      product: selectedProduct,
      productId: selectedProduct.id,
      productName: selectedBrand?.name || selectedProduct.name || "",
      categoryId: selectedProduct.categoryId || selectedBrand?.categoryId || null,

      brandId: selectedBrand?.id || null,
      brandName: selectedBrand?.name || "",

      productType: typeConfig?.label || selectedType,

      sku: variant?.sku || selectedProduct.sku || selectedBrand?.code || "",
      productSku: variant?.sku || selectedProduct.sku || selectedBrand?.code || "",

      variantId: variant?.id || null,
      variant: variant || null,
      matchedVariant: variant || null,

      attributeValues: attributeValuesPayload,

      specifications: [
        { specification: selectedSpecification.label, price: rate },
      ],
      selectedSpecification: selectedSpecification.label,

      defaultPrice: rate,
      price: rate,
      rate,

      stock: safeNumber(variant?.stock),

      /* Quantity = measurement result when filled, otherwise Pcs */
      quantity: measure.active
        ? Number(formatMeasureQty(measure))
        : numericPcs,
      unit: measure.active
        ? measure.unit
        : attributeValuesPayload.Unit || "pcs",

      length: dims.length || attributeValuesPayload.Length || "",
      width: dims.width || attributeValuesPayload.Width || "",
      height: dims.height || attributeValuesPayload.Height || "",
      pcs: numericPcs,

      thickness: attributeValuesPayload.Thickness || "",
      grade: attributeValuesPayload.Grade || "",
      finish: attributeValuesPayload.Finish || "",
      color: attributeValuesPayload.Color || "",
      packSize: attributeValuesPayload["Pack Size"] || "",
    });

    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
      >
        {/* HEADER */}
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
            <Package className="h-4 w-4 text-primary-600" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">
              {mode === "edit" ? "Edit Item" : "Add Item"}
            </div>
            <div className="text-[10px] text-muted">
              Select Product Type, Brand and Pcs, then choose a specification
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* SINGLE LINE: PRODUCT TYPE | BRAND | PCS */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px]">
            <div className="min-w-0">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Product Type
              </span>
              <SearchableSelect
                buttonRef={inputRef}
                value={selectedType}
                onChange={(typeKey) => {
                  setSelectedType(typeKey);
                  setSelectedBrand(null);
                  setSelectedProduct(null);
                  setSelectedSpecification(null);
                  setSelectedVariant(null);
                  setQuery("");
                  resetDimensions();
                }}
                options={PRODUCT_TYPES.map((type) => ({
                  value: type.key,
                  label: type.label,
                }))}
                placeholder="Select Product Type"
                searchPlaceholder="Search product type…"
              />
            </div>

            <div className="min-w-0">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Brand Name
              </span>
              <SearchableSelect
                value={selectedBrand ? String(selectedBrand.id) : ""}
                disabled={!selectedType}
                onChange={(brandId) => {
                  const brand =
                    availableBrands.find((item) =>
                      sameId(item.id, brandId),
                    ) || null;

                  const product = brand ? ensureProductForBrand(brand) : null;

                  setSelectedBrand(brand);
                  setSelectedProduct(product);
                  setSelectedSpecification(null);
                  setSelectedVariant(null);
                  resetDimensions();
                  setQuery("");
                }}
                options={availableBrands.map((brand) => ({
                  value: String(brand.id),
                  label: brand.name,
                }))}
                placeholder="Select Brand"
                searchPlaceholder="Search brand…"
                emptyText="No brands found"
              />
            </div>

            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Pcs
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={pcs}
                onChange={(event) =>
                  setPcs(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
                placeholder="1"
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-center text-sm font-semibold text-ink outline-none transition focus:border-primary-500"
              />
            </label>
          </div>

          {selectedType && !availableBrands.length && (
            <div className="rounded-lg border border-dashed border-line px-3 py-2 text-[10px] text-muted">
              No brands found for this Product Type. Add the brand in Brand
              Master first.
            </div>
          )}

          {/* SPECIFICATION + MEASUREMENT */}
          {selectedBrand && selectedProduct && (
            <SpecificationStep
              typeKey={selectedType}
              specifications={specifications}
              selectedSpecification={selectedSpecification}
              length={length}
              width={width}
              height={height}
              pcs={pcs}
              onLengthChange={setLength}
              onWidthChange={setWidth}
              onHeightChange={setHeight}
              onSelectSpecification={(specification) => {
                setSelectedSpecification(specification);
                setSelectedVariant(specification?.matchedVariant || null);
              }}
              customSpecification={customSpecification}
              customPrice={customPrice}
              onCustomSpecificationChange={setCustomSpecification}
              onCustomPriceChange={setCustomPrice}
              onAddCustomSpecification={handleAddCustomSpecification}
              onAdd={handleAddToLine}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ==========================================================================
   SPECIFICATION + PRICE + MEASUREMENT
   ========================================================================== */

function SpecificationStep({
  typeKey,
  specifications,
  selectedSpecification,

  length,
  width,
  height,
  pcs,

  onLengthChange,
  onWidthChange,
  onHeightChange,

  onSelectSpecification,
  customSpecification,
  customPrice,
  onCustomSpecificationChange,
  onCustomPriceChange,
  onAddCustomSpecification,
  onAdd,
}) {
  const numericPcs = Math.max(1, safeNumber(pcs) || 1);

  const fieldValues = { length, width, height };
  const fieldHandlers = {
    length: onLengthChange,
    width: onWidthChange,
    height: onHeightChange,
  };

  const measure = calcMeasurement(typeKey, fieldValues, numericPcs);

  /* Billing quantity: measurement result when filled, otherwise pieces */
  const billingQty = measure.active ? measure.qty : numericPcs;
  const qtyLabel = measure.active
    ? `${formatMeasureQty(measure)} ${measure.unit}`
    : `${numericPcs} pcs`;

  const formatINR = (value, digits = 2) =>
    Number(value).toLocaleString("en-IN", { maximumFractionDigits: digits });

  const rateOf = (specification) =>
    safeNumber(specification?.price) > 0
      ? safeNumber(specification.price)
      : safeNumber(specification?.matchedVariant?.price);

  const selectedRate = selectedSpecification ? rateOf(selectedSpecification) : 0;
  const needsMeasurement =
    MEASUREMENT_REQUIRED && measure.fields.length > 0 && !measure.active;

  const missingLabel = measure.fields
    .map((field) => MEASURE_LABELS[field].replace(" (ft)", ""))
    .join(", ");

  const total =
    selectedSpecification && !needsMeasurement ? billingQty * selectedRate : 0;

  return (
    <section className="space-y-4">
      <div>
        <div className="text-xs font-bold text-ink">Specifications & Price</div>
        <div className="mt-0.5 text-[10px] text-muted">
          Price is the default rate from Brand Master and does not change with
          Pcs. Only the Total changes.
        </div>
      </div>

      {!specifications.length ? (
        <div className="rounded-lg border border-dashed border-line bg-bg/40 p-4 text-center">
          <div className="text-sm font-bold text-ink">No specifications found</div>
          <div className="mt-1 text-[10px] text-muted">
            Add specifications and prices in Brand Master.
          </div>
        </div>
      ) : (
        <>
          {/* SPECIFICATION TABLE */}
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-[1fr_110px_32px] items-center gap-2 border-b border-line bg-bg/60 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wide text-muted">
              <div>Specification</div>
              <div className="text-right">Price (₹)</div>
              <div />
            </div>

            <div className="divide-y divide-line">
              {specifications.map((specification) => {
                const selected = selectedSpecification?.id === specification.id;
                const rate = rateOf(specification);

                return (
                  <button
                    key={specification.id}
                    type="button"
                    onClick={() => onSelectSpecification(specification)}
                    className={[
                      "grid w-full grid-cols-[1fr_110px_32px] items-center gap-2 px-2.5 py-2.5 text-left transition",
                      selected ? "bg-primary-500/5" : "hover:bg-bg/60",
                    ].join(" ")}
                  >
                    <div className="truncate text-xs font-bold text-ink">
                      {specification.label}
                    </div>

                    <div className="text-right text-xs font-bold text-ink">
                      {rate > 0 ? formatINR(rate) : "—"}
                    </div>

                    <div className="flex justify-end">
                      <div
                        className={[
                          "flex h-4 w-4 items-center justify-center rounded-full border",
                          selected
                            ? "border-primary-500 bg-primary-500 text-white"
                            : "border-line bg-surface",
                        ].join(" ")}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CUSTOM SPECIFICATION + PRICE */}
          <div className="rounded-lg border border-dashed border-line bg-bg/40 p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
              Add specification for this Brand
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
              <input
                value={customSpecification}
                onChange={(event) => onCustomSpecificationChange(event.target.value)}
                placeholder="add specification"
                className="h-9 min-w-0 rounded-lg border border-line bg-surface px-3 text-xs text-ink outline-none focus:border-primary-500"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={customPrice}
                onChange={(event) => onCustomPriceChange(event.target.value)}
                placeholder="Price"
                className="h-9 min-w-0 rounded-lg border border-line bg-surface px-3 text-xs text-ink outline-none focus:border-primary-500"
              />
              <button
                type="button"
                disabled={!String(customSpecification ?? "").trim()}
                onClick={onAddCustomSpecification}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 text-xs font-bold text-primary-600 transition hover:bg-primary-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted">
              Saved to this Brand Master and available next time. It does not overwrite existing prices.
            </p>
          </div>

          {/* MEASUREMENT (fields change with the product type) */}
          <div>
            <div className="mb-2">
              <div className="text-xs font-bold text-ink">
                Measurement
                {measure.fields.length > 0 && MEASUREMENT_REQUIRED && (
                  <span className="ml-0.5 text-red-500">*</span>
                )}
              </div>

              <div className="mt-0.5 text-[10px] text-muted">
                {measure.fields.length
                  ? `${measure.label} = ${measure.fields
                      .map((field) => MEASURE_NAMES[field])
                      .join(" × ")} × Pcs`
                  : "Not needed for this product type. Total = Price × Pcs."}
              </div>
            </div>

            <div
              className={[
                "grid grid-cols-2 gap-2",
                [
                  "",
                  "sm:grid-cols-1",
                  "sm:grid-cols-2",
                  "sm:grid-cols-3",
                  "sm:grid-cols-4",
                  "sm:grid-cols-5",
                ][measure.fields.length + (measure.fields.length ? 2 : 1)],
              ].join(" ")}
            >
              {measure.fields.map((field) => (
                <MeasurementField
                  key={field}
                  label={MEASURE_LABELS[field]}
                  value={fieldValues[field]}
                  onChange={(event) => fieldHandlers[field](event.target.value)}
                  placeholder={MEASURE_NAMES[field]}
                />
              ))}

              {measure.fields.length > 0 && (
                <ReadOnlyMetric
                  label={`${measure.label} (${measure.unit})`}
                  value={measure.active ? formatMeasureQty(measure) : "—"}
                />
              )}

              <ReadOnlyMetric
                label="Total (₹)"
                value={total > 0 ? formatINR(total) : "—"}
                strong
              />
            </div>
          </div>

          {/* SUMMARY + ADD */}
          <div className="flex flex-col gap-3 rounded-lg border border-primary-500/15 bg-primary-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Selected Specification
              </div>

              <div className="mt-0.5 truncate text-sm font-black text-ink">
                {selectedSpecification?.label || "Select a specification"}
              </div>

              <div className="mt-0.5 text-[10px] text-muted">
                {selectedSpecification && needsMeasurement
                  ? `Enter ${missingLabel} to continue.`
                  : selectedSpecification
                  ? selectedRate > 0
                    ? `${qtyLabel} × ₹${formatINR(selectedRate)}`
                    : "No price set in Brand Master"
                  : "Select a specification."}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wide text-muted">
                  Total
                </div>
                <div className="text-base font-black text-ink">
                  ₹ {total > 0 ? formatINR(total) : "0"}
                </div>
              </div>

              <button
                type="button"
                disabled={!selectedSpecification || needsMeasurement}
                onClick={onAdd}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-xs font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                Add to Line
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function MeasurementField({ label, value, onChange, placeholder, min }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>

      <input
        type="number"
        min={min}
        step="any"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 text-center text-xs font-semibold text-ink outline-none transition focus:border-primary-500"
      />
    </label>
  );
}

function ReadOnlyMetric({ label, value, strong = false }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>

      <div
        className={[
          "flex h-10 w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-bg/60 px-2 text-center text-xs",
          strong ? "font-black text-ink" : "font-semibold text-muted",
        ].join(" ")}
      >
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

export default ProductPicker;