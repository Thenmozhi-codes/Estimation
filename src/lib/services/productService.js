import {
  productRepo, variantRepo, variantAttributeRepo, priceRepo,
} from "@/lib/api/repos";
import { recordMovement } from "./stockService";

export const productService = {
  async create({ name, sku, categoryId, brandId, description, status, variants }) {
    const product = await productRepo.create({
      name, sku, categoryId, brandId: brandId || null,
      description: description || "", status: status || "active",
    });
    for (const v of variants) {
      const variant = await variantRepo.create({
        productId: product.id, sku: v.sku,
        isDefault: !!v.isDefault, status: "active",
      });
      for (const a of v.attributes || []) {
        await variantAttributeRepo.create({
          variantId: variant.id, attributeId: a.attributeId,
          attributeValueId: a.attributeValueId || null,
          rawValue: a.rawValue ?? null,
        });
      }
      for (const p of v.prices || []) {
        if (p.amount == null) continue;
        await priceRepo.create({
          variantId: variant.id, priceType: p.priceType,
          amount: p.amount, currency: "INR",
          effectiveFrom: new Date().toISOString(),
        });
      }
      if (v.openingStock) {
        recordMovement({
          variantId: variant.id, type: "opening",
          quantity: v.openingStock, referenceType: "opening",
          notes: "Opening stock",
        });
      }
    }
    return product;
  },
};