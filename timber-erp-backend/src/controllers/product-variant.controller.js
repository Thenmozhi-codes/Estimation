const variantService = require("../services/product-variant.service");
const productService = require("../services/product.service");
const { createAuditLog } = require("../services/audit.service");

async function getAllVariants(req, res) {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product =
      await productService.getProductById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variants =
      await variantService.getAllVariants(productId);

    return res.status(200).json({
      success: true,
      data: variants,
    });
  } catch (error) {
    console.error("Get variants error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product variants",
    });
  }
}

async function getVariantById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const variant =
      await variantService.getVariantById(id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: variant,
    });
  } catch (error) {
    console.error("Get variant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product variant",
    });
  }
}

async function createVariant(req, res) {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product =
      await productService.getProductById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const {
      sku,
      reorderLevel = 0,
    } = req.body;

    if (!sku || !String(sku).trim()) {
      return res.status(400).json({
        success: false,
        message: "SKU is required",
      });
    }

    const numericReorderLevel =
      Number(reorderLevel);

    if (
      !Number.isFinite(numericReorderLevel) ||
      numericReorderLevel < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Reorder level must be a non-negative number",
      });
    }

    const variant =
      await variantService.createVariant({
        productId,
        sku: String(sku).trim().toUpperCase(),
        reorderLevel: numericReorderLevel,
        createdById: req.user.id,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "product_variants",
      entityId: variant.id,
      beforeData: null,
      afterData: variant,
    });

    return res.status(201).json({
      success: true,
      message: "Product variant created successfully",
      data: variant,
    });
  } catch (error) {
    console.error("Create variant error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "SKU already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create product variant",
    });
  }
}

async function updateVariant(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const existingVariant =
      await variantService.getVariantById(id);

    if (!existingVariant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const {
      sku,
      reorderLevel,
      isActive,
    } = req.body;

    if (
      sku === undefined &&
      reorderLevel === undefined &&
      isActive === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one field is required to update",
      });
    }

    if (sku !== undefined && !String(sku).trim()) {
      return res.status(400).json({
        success: false,
        message: "SKU cannot be empty",
      });
    }

    let numericReorderLevel;

    if (reorderLevel !== undefined) {
      numericReorderLevel = Number(reorderLevel);

      if (
        !Number.isFinite(numericReorderLevel) ||
        numericReorderLevel < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Reorder level must be a non-negative number",
        });
      }
    }

    const variant =
      await variantService.updateVariant(id, {
        sku:
          sku !== undefined
            ? String(sku).trim().toUpperCase()
            : undefined,

        reorderLevel: numericReorderLevel,

        isActive,

        updatedById: req.user.id,
      });

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "product_variants",
      entityId: id,
      beforeData: existingVariant,
      afterData: variant,
    });

    return res.status(200).json({
      success: true,
      message: "Product variant updated successfully",
      data: variant,
    });
  } catch (error) {
    console.error("Update variant error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "SKU already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update product variant",
    });
  }
}

async function deleteVariant(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const existingVariant =
      await variantService.getVariantById(id);

    if (!existingVariant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    await variantService.deleteVariant(
      id,
      req.user.id
    );

    const afterVariant =
      await variantService.getVariantById(id);

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "product_variants",
      entityId: id,
      beforeData: existingVariant,
      afterData: afterVariant,
    });

    return res.status(200).json({
      success: true,
      message: "Product variant deleted successfully",
    });
  } catch (error) {
    console.error("Delete variant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product variant",
    });
  }
}

module.exports = {
  getAllVariants,
  getVariantById,
  createVariant,
  updateVariant,
  deleteVariant,
};