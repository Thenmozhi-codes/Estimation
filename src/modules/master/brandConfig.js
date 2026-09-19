/*
 * Phase 2 business rule:
 * Brand is created against one of the five standard Product Types.
 * The existing mock data uses "Adhesive" internally; the user-facing
 * Product Type is "Fevicol" to match the current business/reference flow.
 */
export const FIXED_PRODUCT_TYPES = [
  { label: "Plywood", categoryName: "Plywood" },
  { label: "Laminate", categoryName: "Laminate" },
  { label: "Edge Band", categoryName: "Edge Band" },
  { label: "WPC", categoryName: "WPC" },
  { label: "Fevicol", categoryName: "Adhesive" },
];

export function normalize(value) {
  return String(value || "").trim().toLowerCase();
}


const LEGACY_BRAND_TYPES = {
  Plywood: [
    "Sharon Gold", "Sharon Sovereign", "Mikasa MR+", "Mikasa BWP+",
    "Mikasa Marine", "Mikasa Marine Blue", "Hardwood Ply", "Afyun Plywood",
    "Ambi Plywood", "Green HDWR", "Action Tesa HDHMR",
  ],
  Laminate: [
    "Merino Laminate", "Greenlam Laminate", "Century Laminate",
    "Formica Laminate", "Sundek Laminate", "Decolam Laminate",
    "Royal Touch Laminate", "Virgo Laminate", "Archidply Laminate",
    "Action Laminate",
  ],
  "Edge Band": [
    "Rehau Edge Band", "Banda Edge Band", "Virutex Edge Band",
    "Century Edge Band", "Greenlam Edge Band", "Merino Edge Band",
  ],
  WPC: ["WPC Frame", "WPC Door Frame", "WPC Door"],
  Fevicol: [
    "Fevicol SH", "Fevicol HI-PER", "Fevicol HI-PER Star",
    "Fevicol Heatex", "Fevicol Probond",
  ],
};

const LEGACY_TYPE_BY_BRAND = Object.fromEntries(
  Object.entries(LEGACY_BRAND_TYPES).flatMap(([label, names]) =>
    names.map((name) => [normalize(name), label]),
  ),
);

export function getFixedProductTypes(categories = []) {
  const byName = new Map(
    categories
      .filter((category) => category?.isActive !== false)
      .map((category) => [normalize(category.name), category]),
  );

  return FIXED_PRODUCT_TYPES
    .map((type) => {
      const category = byName.get(normalize(type.categoryName));
      return category
        ? { ...type, categoryId: category.id, categoryName: category.name }
        : null;
    })
    .filter(Boolean);
}

export function resolveBrandCategoryId(brand, products = [], categories = []) {
  if (brand?.categoryId) return brand.categoryId;

  const linkedProduct = products.find((product) => product.brandId === brand?.id);
  if (linkedProduct?.categoryId) return linkedProduct.categoryId;

  const legacyLabel = LEGACY_TYPE_BY_BRAND[normalize(brand?.name)];
  if (!legacyLabel) return "";

  const type = getFixedProductTypes(categories).find(
    (item) => item.label === legacyLabel,
  );
  return type?.categoryId || "";
}
