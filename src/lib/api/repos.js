import { createRepo } from "./baseRepo";

/* ─────── Masters ─────── */
export const companyRepo           = createRepo("companies");
export const userRepo              = createRepo("users");
export const unitRepo              = createRepo("units",   { softDelete: true });
export const brandRepo             = createRepo("brands",  { softDelete: true });
export const taxRepo               = createRepo("taxes",   { softDelete: true });
export const attributeRepo         = createRepo("attributes", { softDelete: true });
export const attributeValueRepo    = createRepo("attributeValues", { softDelete: true });
export const categoryRepo          = createRepo("categories", { softDelete: true });
export const categoryAttributeRepo = createRepo("categoryAttributes");

/* ─────── Products ─────── */
export const productRepo           = createRepo("products", { softDelete: true });
export const variantRepo           = createRepo("variants");
export const variantAttributeRepo  = createRepo("variantAttributes");
export const priceRepo             = createRepo("prices");

/* ─────── Stock ─────── */
export const stockRepo             = createRepo("stock");
export const stockMovementRepo     = createRepo("stockMovements");

/* ─────── Parties ─────── */
export const partyRepo             = createRepo("parties", { softDelete: true });

/* ─────── Sales documents ─────── */
export const quotationRepo         = createRepo("quotations");
export const quotationItemRepo     = createRepo("quotationItems");
export const invoiceRepo           = createRepo("invoices");
export const invoiceItemRepo       = createRepo("invoiceItems");
export const paymentRepo           = createRepo("payments");

/* ─────── Purchases ─────── */
export const purchaseRepo          = createRepo("purchases");
export const purchaseItemRepo      = createRepo("purchaseItems");

/* ────────────────────────────────────────────────────────────────
 * variantResolver
 *
 * Materializes a ProductVariant on demand from a set of attribute
 * selections made at the bill line-item level.
 *
 * Attribute Master (CategoryAttributes + AttributeValues) is the
 * single source of truth for which attributes and values are valid
 * for a given Product Type.
 * ──────────────────────────────────────────────────────────────── */
export const variantResolver = {
  async resolveOrCreate({ productId, defaultSku, attributeValues }) {
    if (!productId) {
      throw new Error("variantResolver: productId is required");
    }

    const pairs = Object.entries(attributeValues || {}).filter(
      ([, valueId]) => Boolean(valueId),
    );

    const variantsRaw = await variantRepo.list({ productId });
    const variants = Array.isArray(variantsRaw)
      ? variantsRaw
      : variantsRaw?.data ?? [];

    // No attribute picks → default variant
    if (pairs.length === 0) {
      const existingDefault =
        variants.find((v) => v.isDefault) || variants[0];
      if (existingDefault) return existingDefault;

      return variantRepo.create({
        productId,
        sku: defaultSku,
        isDefault: true,
        status: "active",
      });
    }

    // Exact attribute-set match?
    const variantAttrsByVariant = await Promise.all(
      variants.map((v) =>
        variantAttributeRepo.list({ variantId: v.id }),
      ),
    );

    const match = variants.find((_, i) => {
      const attrs = variantAttrsByVariant[i] || [];
      if (attrs.length !== pairs.length) return false;
      return pairs.every(([attrId, valueId]) =>
        attrs.some(
          (a) =>
            a.attributeId === attrId &&
            a.attributeValueId === valueId,
        ),
      );
    });
    if (match) return match;

    // Create a new variant with a deterministic SKU
    const valueRows = await Promise.all(
      pairs.map(([, valueId]) => attributeValueRepo.get(valueId)),
    );

    const suffix = valueRows
      .map((v) => v?.code || "OPT")
      .join("-");
    const sku = defaultSku ? `${defaultSku}-${suffix}` : suffix;

    const variant = await variantRepo.create({
      productId,
      sku,
      isDefault: false,
      status: "active",
    });

    for (const [attributeId, attributeValueId] of pairs) {
      await variantAttributeRepo.create({
        variantId: variant.id,
        attributeId,
        attributeValueId,
      });
    }

    return variant;
  },
};