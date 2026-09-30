import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Package, X } from "lucide-react";

import { mockStore } from "@/lib/store/mockStore";
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

  /* MEASUREMENT STATE (these were missing before) */
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
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

  function resetMeasurement() {
    setLength("");
    setWidth("");
    setPcs(1);
  }

  /* RESET WHEN OPENED */
  useEffect(() => {
    if (!open) return;

    setSelectedType("");
    setSelectedBrand(null);
    setSelectedProduct(null);
    setSelectedSpecification(null);
    setSelectedVariant(null);
    setQuery("");
    setLength("");
    setWidth("");
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

  /* CLOSED */
  if (!open) return null;

  const typeConfig = getTypeConfig(selectedType);

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

    const attributeValuesPayload = {
      ...(variant?.attributes || {}),
      Unit:
        variant?.attributes?.Unit ||
        legacyMaterialDetails?.unit ||
        legacyMaterialDetails?.uom ||
        legacyMaterialDetails?.unitName ||
        "",
    };

    /* PRICE: Brand Master first, then variant */
    const brandPrice = safeNumber(selectedSpecification.price);
    const variantPrice = safeNumber(variant?.price);
    const rate = brandPrice > 0 ? brandPrice : variantPrice;

    /* MEASUREMENT */
    const numericLength = safeNumber(length);
    const numericWidth = safeNumber(width);
    const numericPcs = Math.max(1, safeNumber(pcs) || 1);
    const hasArea = numericLength > 0 && numericWidth > 0;
    const area = hasArea ? numericLength * numericWidth * numericPcs : 0;

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

      /* Quantity = area (sq.ft) when dimensions are entered */
      quantity: hasArea ? Number(area.toFixed(2)) : numericPcs,
      unit: hasArea ? "sq.ft" : attributeValuesPayload.Unit || "pcs",

      length: numericLength || attributeValuesPayload.Length || "",
      width: numericWidth || attributeValuesPayload.Width || "",
      pcs: numericPcs,

      thickness: attributeValuesPayload.Thickness || "",
      grade: attributeValuesPayload.Grade || "",
      finish: attributeValuesPayload.Finish || "",
      color: attributeValuesPayload.Color || "",
      packSize: attributeValuesPayload["Pack Size"] || "",
    });

    onClose();
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex max-h-[82vh] w-full flex-col overflow-hidden">
        {/* HEADER */}
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3 sm:px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
            <Package className="h-4 w-4 text-primary-600" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">
              {mode === "edit" ? "Edit Item" : "Add Item"}
            </div>
            <div className="text-[10px] text-muted">
              Select Product Type, Brand and Specification
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
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="space-y-4">
            {/* 1. PRODUCT TYPE */}
            <section>
              <div className="mb-2">
                <div className="text-xs font-bold text-ink">Product Type</div>
                <div className="text-[10px] text-muted">
                  Choose the material category first.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {PRODUCT_TYPES.map((type) => {
                  const active = selectedType === type.key;

                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => {
                        setSelectedType(type.key);
                        setSelectedBrand(null);
                        setSelectedProduct(null);
                        setSelectedSpecification(null);
                        setSelectedVariant(null);
                        setQuery("");
                        resetMeasurement();
                      }}
                      className={[
                        "min-h-10 rounded-lg border px-2.5 py-2 text-xs font-bold transition",
                        active
                          ? "border-primary-500 bg-primary-500 text-white shadow-sm"
                          : "border-line bg-surface text-ink hover:border-primary-500/40 hover:bg-primary-500/5",
                      ].join(" ")}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. BRAND */}
            {selectedType && (
              <section className="rounded-xl border border-line bg-bg/30 p-3 sm:p-4">
                <div className="mb-2">
                  <div className="text-xs font-bold text-ink">Brand Name</div>
                  <div className="text-[10px] text-muted">
                    Select a brand from Brand Master.
                  </div>
                </div>

                <select
                  ref={inputRef}
                  value={selectedBrand?.id || ""}
                  onChange={(event) => {
                    const brand =
                      availableBrands.find((item) =>
                        sameId(item.id, event.target.value),
                      ) || null;

                    const product = brand ? ensureProductForBrand(brand) : null;

                    setSelectedBrand(brand);
                    setSelectedProduct(product);
                    setSelectedSpecification(null);
                    setSelectedVariant(null);
                    resetMeasurement();
                    setQuery("");
                  }}
                  className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary-500"
                >
                  <option value="">Select Brand</option>

                  {availableBrands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>

                {!availableBrands.length && (
                  <div className="mt-2 rounded-lg border border-dashed border-line px-3 py-2 text-[10px] text-muted">
                    No brands found for this Product Type. Add the brand in
                    Brand Master first.
                  </div>
                )}
              </section>
            )}

            {/* 3. SPECIFICATION + MEASUREMENT */}
            {selectedBrand && selectedProduct && (
              <SpecificationStep
                specifications={specifications}
                selectedSpecification={selectedSpecification}
                length={length}
                width={width}
                pcs={pcs}
                onLengthChange={setLength}
                onWidthChange={setWidth}
                onPcsChange={setPcs}
                onSelectSpecification={(specification) => {
                  setSelectedSpecification(specification);
                  setSelectedVariant(specification?.matchedVariant || null);
                }}
                onAdd={handleAddToLine}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   SPECIFICATION + PRICE + MEASUREMENT
   ========================================================================== */

function SpecificationStep({
  specifications,
  selectedSpecification,

  length,
  width,
  pcs,

  onLengthChange,
  onWidthChange,
  onPcsChange,

  onSelectSpecification,
  onAdd,
}) {
  const selectedPrice = selectedSpecification
    ? safeNumber(selectedSpecification.price) > 0
      ? safeNumber(selectedSpecification.price)
      : safeNumber(selectedSpecification.matchedVariant?.price)
    : 0;

  const numericLength = safeNumber(length);
  const numericWidth = safeNumber(width);
  const numericPcs = Math.max(1, safeNumber(pcs) || 1);

  const hasDimensions = numericLength > 0 && numericWidth > 0;
  const area = hasDimensions ? numericLength * numericWidth * numericPcs : 0;

  /* Billing quantity: area when L × W entered, otherwise number of pieces */
  const billingQty = hasDimensions ? area : numericPcs;
  const total = selectedSpecification ? billingQty * selectedPrice : 0;

  const formatINR = (value, digits = 2) =>
    Number(value).toLocaleString("en-IN", { maximumFractionDigits: digits });

  return (
    <section className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="mb-3">
        <div className="text-xs font-bold text-ink">Specifications & Price</div>
        <div className="mt-0.5 text-[10px] text-muted">
          Select specification configured for this brand. Price is automatically
          loaded from Brand Master.
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
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="hidden grid-cols-[1fr_130px_42px] items-center border-b border-line bg-bg/60 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wide text-muted sm:grid">
              <div>Specification</div>
              <div>Price (₹)</div>
              <div>Select</div>
            </div>

            <div className="divide-y divide-line">
              {specifications.map((specification) => {
                const selected = selectedSpecification?.id === specification.id;

                const price =
                  safeNumber(specification.price) > 0
                    ? safeNumber(specification.price)
                    : safeNumber(specification.matchedVariant?.price);

                return (
                  <button
                    key={specification.id}
                    type="button"
                    onClick={() => onSelectSpecification(specification)}
                    className={[
                      "grid w-full grid-cols-1 gap-2 px-2.5 py-2.5 text-left transition sm:grid-cols-[1fr_130px_42px] sm:items-center sm:gap-2",
                      selected ? "bg-primary-500/5" : "hover:bg-bg/60",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold",
                          selected
                            ? "border-primary-500 bg-primary-500 text-white"
                            : "border-line bg-bg text-muted",
                        ].join(" ")}
                      >
                        {selected ? <Check className="h-3.5 w-3.5" /> : "•"}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-ink">
                          {specification.label}
                        </div>
                        <div className="mt-0.5 text-[9px] text-muted sm:hidden">
                          Price: ₹ {formatINR(price)}
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block">
                      <div className="text-xs font-bold text-ink">
                        ₹ {formatINR(price)}
                      </div>
                    </div>

                    <div className="hidden justify-end sm:flex">
                      <div
                        className={[
                          "h-4 w-4 rounded-full border",
                          selected
                            ? "border-primary-500 bg-primary-500"
                            : "border-line bg-surface",
                        ].join(" ")}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MEASUREMENT GRID */}
          <div className="mt-4">
            <div className="mb-2 text-xs font-bold text-ink">Measurement</div>

            <div className="overflow-hidden rounded-xl border border-line">
              <div className="hidden grid-cols-6 gap-2 border-b border-line bg-bg/60 px-2.5 py-2 sm:grid">
                {["L (ft)", "W (ft)", "Pcs", "Area (sq.ft)", "Price (₹)", "Total (₹)"].map(
                  (heading) => (
                    <div
                      key={heading}
                      className="text-[9px] font-bold uppercase tracking-wide text-muted"
                    >
                      {heading}
                    </div>
                  ),
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-6 sm:items-center">
                <MeasurementField
                  label="L (ft)"
                  value={length}
                  onChange={(event) => onLengthChange(event.target.value)}
                  placeholder="0"
                />

                <MeasurementField
                  label="W (ft)"
                  value={width}
                  onChange={(event) => onWidthChange(event.target.value)}
                  placeholder="0"
                />

                <MeasurementField
                  label="Pcs"
                  value={pcs}
                  min="1"
                  onChange={(event) =>
                    onPcsChange(
                      event.target.value === "" ? "" : Number(event.target.value),
                    )
                  }
                  placeholder="1"
                />

                <ReadOnlyMetric
                  label="Area (sq.ft)"
                  value={area > 0 ? area.toFixed(2) : "—"}
                />

                <ReadOnlyMetric
                  label="Price (₹)"
                  value={selectedPrice > 0 ? formatINR(selectedPrice) : "—"}
                />

                <ReadOnlyMetric
                  label="Total (₹)"
                  value={total > 0 ? formatINR(total) : "—"}
                  strong
                />
              </div>
            </div>
          </div>

          {/* SUMMARY + ADD */}
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-primary-500/15 bg-primary-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Selected Specification
              </div>

              <div className="mt-0.5 truncate text-sm font-black text-ink">
                {selectedSpecification?.label || "Select a specification"}
              </div>

              <div className="mt-0.5 text-[10px] text-muted">
                {selectedSpecification
                  ? selectedPrice > 0
                    ? hasDimensions
                      ? `${area.toFixed(2)} sq.ft × ₹${formatINR(selectedPrice)}`
                      : `${numericPcs} pcs × ₹${formatINR(selectedPrice)}`
                    : `Price: ₹${formatINR(selectedPrice)}`
                  : "Select specification and enter dimensions."}
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
                disabled={!selectedSpecification}
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
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted sm:hidden">
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
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted sm:hidden">
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