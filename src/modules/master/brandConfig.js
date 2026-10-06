/*
 * Phase 2 business rule:
 * Brand is created against one of the standard Product Types.
 * The existing mock data uses "Adhesive" internally; the user-facing
 * Product Type is "Fevicol" to match the current business/reference flow.
 */
export const FIXED_PRODUCT_TYPES = [
  { label: "Plywood", categoryName: "Plywood" },
  { label: "Laminate", categoryName: "Laminate" },
  { label: "Edge Band", categoryName: "Edge Band" },
  { label: "WPC", categoryName: "WPC" },
  { label: "Fevicol", categoryName: "Adhesive" },
  { label: "Timber", categoryName: "Timber" },
  { label: "Beading", categoryName: "Beading" },
  { label: "Laminated Board", categoryName: "Laminated Board" },
  { label: "HMR Board", categoryName: "HMR Board" },
  { label: "Door", categoryName: "Door" },
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
      /*
       * Match the internal category name first ("Adhesive"), then the
       * visible label ("Fevicol"), so the type is found whichever name
       * the Specifications master created it under.
       */
      const category =
        byName.get(normalize(type.categoryName)) ||
        byName.get(normalize(type.label));

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

/* ==========================================================================
   SPECIFICATION LISTS (Brand Form)
========================================================================== */

/*
 * These five always use their own list (the shared "Thickness" master
 * attribute mixes values of several types, so it is not used for them).
 */
export const FIXED_SPECIFICATIONS = {
  Plywood: ["19mm", "18mm", "16mm", "12mm", "9mm", "6mm"],
  Laminate: ["0.6mm", "0.8mm", "1mm"],
  "Edge Band": ["0.5mm"],
  WPC: ["3x2 inch", "4x2.5 inch"],
  Fevicol: ["1/2kg", "1kg", "2kg", "5kg", "10kg", "20kg", "50kg"],
};

/*
 * These types read Master -> Specifications. The list below is used ONLY
 * when the master has no values yet (for example before the Specifications
 * page has been opened once), so the Brand Form is never empty.
 * Same values as the Specifications master default setup.
 */
export const DEFAULT_SPECIFICATIONS = {
  Timber: ["1 inch", "1.5 inch", "2 inch", "3 inch", "4 inch"],
  Beading: ["1/2 inch", "3/4 inch", "1 inch"],
  "Laminated Board": ["19mm", "18mm", "16mm", "12mm", "9mm", "6mm"],
  "HMR Board": ["19mm", "18mm", "16mm", "12mm"],
  Door: ["40mm", "35mm", "32mm", "30mm", "25mm", "18mm"],
};

const lookup = (map, label) => {
  const key = Object.keys(map).find((item) => normalize(item) === normalize(label));
  return key ? map[key] : null;
};

/* Specification values to show for a Product Type (no duplicates) */
export function resolveSpecificationValues(label, masterValues = []) {
  const clean = (list) => {
    const seen = new Set();

    return (list || [])
      .map((value) => String(value ?? "").trim())
      .filter((value) => {
        const key = normalize(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const fixed = lookup(FIXED_SPECIFICATIONS, label);
  if (fixed) return clean(fixed);

  const master = clean(masterValues);
  if (master.length) return master;

  return clean(lookup(DEFAULT_SPECIFICATIONS, label) || []);
}

/*
 * Rows for the form: the type's values (keeping any price already typed)
 * plus rows the user added by hand (`manual`). Returns `previous` itself
 * when nothing changed, so React does not re-render for nothing.
 */
export function mergeSpecifications(previous = [], values = []) {
  const prices = new Map(
    previous.map((item) => [normalize(item.specification), item.price ?? ""]),
  );

  const defaults = values.map((value) => ({
    specification: value,
    price: prices.get(normalize(value)) ?? "",
  }));

  const defaultKeys = new Set(values.map((value) => normalize(value)));

  const manual = previous.filter(
    (item) => item.manual && !defaultKeys.has(normalize(item.specification)),
  );

  const next = [...defaults, ...manual];

  const same =
    previous.length === next.length &&
    previous.every((item, index) => {
      const other = next[index];

      return (
        String(item.specification ?? "") === String(other.specification ?? "") &&
        String(item.price ?? "") === String(other.price ?? "") &&
        Boolean(item.manual) === Boolean(other.manual)
      );
    });

  return same ? previous : next;
}

/* Specifications saved on an existing brand -> form rows */
export function mapSavedSpecifications(brand) {
  if (!Array.isArray(brand?.specifications)) return [];

  return brand.specifications
    .map((item) => {
      if (typeof item === "string") {
        return { specification: item, price: "" };
      }

      return {
        specification:
          item?.specification || item?.name || item?.value || item?.label || "",
        price:
          item?.price !== undefined && item?.price !== null
            ? String(item.price)
            : "",
      };
    })
    .filter((item) => item.specification);
}

/* Unit saved on an existing brand */
export function readSavedUnit(brand) {
  const details = brand?.materialDetails || brand?.materialData || brand?.details || {};

  if (!details || typeof details !== "object" || Array.isArray(details)) return "";

  return details.unit || details.uom || details.unitName || "";
}
