const variantPriceService = require(
  "../services/variant-price.service"
);

const { createAuditLog } = require(
  "../services/audit.service"
);


// =====================================================
// GET ALL PRICES FOR VARIANT
// =====================================================
async function getVariantPrices(req, res) {
  try {
    const variantId = Number(
      req.params.variantId
    );

    if (
      !Number.isInteger(variantId) ||
      variantId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const variant =
      await variantPriceService.getVariantById(
        variantId
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const prices =
      await variantPriceService.getVariantPrices(
        variantId
      );

    return res.status(200).json({
      success: true,
      data: prices,
    });

  } catch (error) {
    console.error(
      "Get variant prices error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch variant prices",
    });
  }
}


// =====================================================
// GET PRICE BY ID
// =====================================================
async function getVariantPriceById(req, res) {
  try {
    const id = Number(
      req.params.id
    );

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant price ID",
      });
    }

    const price =
      await variantPriceService.getVariantPriceById(
        id
      );

    if (!price) {
      return res.status(404).json({
        success: false,
        message: "Variant price not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: price,
    });

  } catch (error) {
    console.error(
      "Get variant price error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch variant price",
    });
  }
}


// =====================================================
// CREATE VARIANT PRICE
// =====================================================
async function createVariantPrice(req, res) {
  try {
    const variantId = Number(
      req.params.variantId
    );

    if (
      !Number.isInteger(variantId) ||
      variantId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const {
      priceTierId,
      price,
    } = req.body || {};


    // ---------------------------------------------
    // VALIDATE PRICE TIER ID
    // ---------------------------------------------
    const priceTierIdNumber = Number(
      priceTierId
    );

    if (
      !Number.isInteger(priceTierIdNumber) ||
      priceTierIdNumber <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid price tier ID is required",
      });
    }


    // ---------------------------------------------
    // VALIDATE PRICE
    // ---------------------------------------------
    const priceNumber = Number(price);

    if (
      price === undefined ||
      price === null ||
      price === "" ||
      !Number.isFinite(priceNumber) ||
      priceNumber < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid price is required",
      });
    }


    // ---------------------------------------------
    // CHECK VARIANT
    // ---------------------------------------------
    const variant =
      await variantPriceService.getVariantById(
        variantId
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }


    // ---------------------------------------------
    // CHECK PRICE TIER
    // ---------------------------------------------
    const priceTier =
      await variantPriceService.getPriceTierById(
        priceTierIdNumber
      );

    if (!priceTier) {
      return res.status(404).json({
        success: false,
        message: "Price tier not found",
      });
    }


    // ---------------------------------------------
    // CHECK DUPLICATE
    // ---------------------------------------------
    const existing =
      await variantPriceService
        .getExistingVariantPrice(
          variantId,
          priceTierIdNumber
        );

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "A price already exists for this variant and price tier",
      });
    }


    // ---------------------------------------------
    // CREATE
    // ---------------------------------------------
    const created =
      await variantPriceService.createVariantPrice({
        variantId,
        priceTierId: priceTierIdNumber,
        price: priceNumber,
      });


    // ---------------------------------------------
    // AUDIT
    // ---------------------------------------------
    await createAuditLog({
      req,
      action: "CREATE",
      entity: "variant_prices",
      entityId: created.id,
      beforeData: null,
      afterData: created,
    });


    return res.status(201).json({
      success: true,
      message: "Variant price created successfully",
      data: created,
    });

  } catch (error) {
    console.error(
      "Create variant price error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "A price already exists for this variant and price tier",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create variant price",
    });
  }
}


// =====================================================
// UPDATE VARIANT PRICE
// =====================================================
async function updateVariantPrice(req, res) {
  try {
    const id = Number(
      req.params.id
    );

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant price ID",
      });
    }

    const existing =
      await variantPriceService.getVariantPriceById(
        id
      );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Variant price not found",
      });
    }

    const {
      priceTierId,
      price,
    } = req.body || {};


    // ---------------------------------------------
    // PRICE TIER
    // ---------------------------------------------
    let priceTierIdNumber;

    if (priceTierId !== undefined) {
      priceTierIdNumber = Number(
        priceTierId
      );

      if (
        !Number.isInteger(priceTierIdNumber) ||
        priceTierIdNumber <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid price tier ID",
        });
      }

      const priceTier =
        await variantPriceService.getPriceTierById(
          priceTierIdNumber
        );

      if (!priceTier) {
        return res.status(404).json({
          success: false,
          message: "Price tier not found",
        });
      }


      // Check duplicate only when tier changes
      if (
        priceTierIdNumber !==
        Number(existing.price_tier_id)
      ) {
        const duplicate =
          await variantPriceService
            .getExistingVariantPrice(
              existing.variant_id,
              priceTierIdNumber
            );

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message:
              "A price already exists for this variant and price tier",
          });
        }
      }
    }


    // ---------------------------------------------
    // PRICE
    // ---------------------------------------------
    let priceNumber;

    if (price !== undefined) {
      priceNumber = Number(price);

      if (
        !Number.isFinite(priceNumber) ||
        priceNumber < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid positive number",
        });
      }
    }


    // ---------------------------------------------
    // UPDATE
    // ---------------------------------------------
    const updated =
      await variantPriceService.updateVariantPrice(
        id,
        {
          priceTierId:
            priceTierId !== undefined
              ? priceTierIdNumber
              : undefined,

          price:
            price !== undefined
              ? priceNumber
              : undefined,
        }
      );


    // ---------------------------------------------
    // AUDIT
    // ---------------------------------------------
    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "variant_prices",
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });


    return res.status(200).json({
      success: true,
      message: "Variant price updated successfully",
      data: updated,
    });

  } catch (error) {
    console.error(
      "Update variant price error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "A price already exists for this variant and price tier",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update variant price",
    });
  }
}


// =====================================================
// DELETE VARIANT PRICE
// =====================================================
async function deleteVariantPrice(req, res) {
  try {
    const id = Number(
      req.params.id
    );

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant price ID",
      });
    }

    const existing =
      await variantPriceService.getVariantPriceById(
        id
      );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Variant price not found",
      });
    }


    const deleted =
      await variantPriceService.deleteVariantPrice(
        id
      );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Variant price not found",
      });
    }


    // ---------------------------------------------
    // AUDIT
    // ---------------------------------------------
    await createAuditLog({
      req,
      action: "DELETE",
      entity: "variant_prices",
      entityId: id,
      beforeData: existing,
      afterData: null,
    });


    return res.status(200).json({
      success: true,
      message: "Variant price deleted successfully",
    });

  } catch (error) {
    console.error(
      "Delete variant price error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete variant price",
    });
  }
}


module.exports = {
  getVariantPrices,
  getVariantPriceById,
  createVariantPrice,
  updateVariantPrice,
  deleteVariantPrice,
};