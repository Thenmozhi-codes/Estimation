const { z } = require("zod");

const productIdSchema = z.object({
  params: z.object({
    id: z.coerce
      .number()
      .int("Product ID must be an integer")
      .positive("Product ID must be positive"),
  }),
});

const createProductSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, "Product name is required")
      .max(191, "Product name must not exceed 191 characters"),

    categoryId: z.coerce
      .number()
      .int("Category ID must be an integer")
      .positive("Category ID must be positive"),

    baseUnitId: z.coerce
      .number()
      .int("Base unit ID must be an integer")
      .positive("Base unit ID must be positive"),

    brandId: z.union([
      z.coerce.number().int().positive("Brand ID must be positive"),
      z.literal(""),
      z.null(),
    ]).optional(),

    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .nullable()
      .optional(),
  }),
});

const updateProductSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, "Product name cannot be empty")
      .max(191, "Product name must not exceed 191 characters")
      .optional(),

    categoryId: z.coerce
      .number()
      .int("Category ID must be an integer")
      .positive("Category ID must be positive")
      .optional(),

    baseUnitId: z.coerce
      .number()
      .int("Base unit ID must be an integer")
      .positive("Base unit ID must be positive")
      .optional(),

    brandId: z.union([
      z.coerce.number().int().positive("Brand ID must be positive"),
      z.literal(""),
      z.null(),
    ]).optional(),

    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .nullable()
      .optional(),

    isActive: z.boolean().optional(),
  }).refine(
    (body) => Object.keys(body).length > 0,
    {
      message: "At least one field is required for update",
    }
  ),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
};