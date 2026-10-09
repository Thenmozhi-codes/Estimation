const stockMovementService = require("../services/stock-movement.service");
const { createAuditLog } = require("../services/audit.service");

const {
  ALL_MOVEMENT_TYPES,
  POSITIVE_MOVEMENT_TYPES,
  NEGATIVE_MOVEMENT_TYPES,
} = stockMovementService;

function validateIntegerId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function validateQuantity(type, quantity) {
  const numericQuantity = Number(quantity);

  if (!Number.isFinite(numericQuantity)) {
    return "quantity must be a valid number";
  }

  if (numericQuantity === 0) {
    return "quantity cannot be zero";
  }

  /*
   * Normal movements are always positive.
   * The movement type determines whether stock increases
   * or decreases.
   *
   * ADJUSTMENT can be positive or negative.
   */
  if (
    [...POSITIVE_MOVEMENT_TYPES, ...NEGATIVE_MOVEMENT_TYPES].includes(
      type
    )
  ) {
    if (numericQuantity <= 0) {
      return `quantity must be greater than 0 for ${type}`;
    }
  }

  return null;
}

async function getAllStockMovements(req, res) {
  try {
    const variantId = req.query.variantId
      ? validateIntegerId(req.query.variantId)
      : null;

    if (req.query.variantId && !variantId) {
      return res.status(400).json({
        success: false,
        message: "Invalid variantId",
      });
    }

    let type = null;

    if (req.query.type) {
      type = String(req.query.type).trim().toUpperCase();

      if (!ALL_MOVEMENT_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid type. Allowed: OPENING, PURCHASE, SALE, RETURN_IN, RETURN_OUT, ADJUSTMENT",
        });
      }
    }

    const refType = req.query.refType
      ? String(req.query.refType).trim()
      : null;

    const movements =
      await stockMovementService.getStockMovements({
        variantId,
        type,
        refType,
      });

    return res.status(200).json({
      success: true,
      data: movements,
    });
  } catch (error) {
    console.error(
      "Get stock movements error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock movements",
    });
  }
}

async function getStockMovementById(req, res) {
  try {
    const id = validateIntegerId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock movement ID",
      });
    }

    const movement =
      await stockMovementService.getStockMovementById(id);

    if (!movement) {
      return res.status(404).json({
        success: false,
        message: "Stock movement not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: movement,
    });
  } catch (error) {
    console.error(
      "Get stock movement error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock movement",
    });
  }
}

async function getVariantStock(req, res) {
  try {
    const variantId = validateIntegerId(
      req.params.variantId
    );

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const variant =
      await stockMovementService.getVariant(variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const stock =
      await stockMovementService.getVariantStockBalance(
        variantId
      );

    return res.status(200).json({
      success: true,
      data: stock,
    });
  } catch (error) {
    console.error(
      "Get variant stock error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock balance",
    });
  }
}

async function getVariantMovements(req, res) {
  try {
    const variantId = validateIntegerId(
      req.params.variantId
    );

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const variant =
      await stockMovementService.getVariant(variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const movements =
      await stockMovementService.getStockMovements({
        variantId,
      });

    return res.status(200).json({
      success: true,
      data: movements,
    });
  } catch (error) {
    console.error(
      "Get variant movements error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch variant stock movements",
    });
  }
}

async function createStockMovement(req, res) {
  try {
    const {
      variantId,
      type,
      quantity,
      refType = null,
      refId = null,
      note = null,
    } = req.body;

    const parsedVariantId = validateIntegerId(
      variantId
    );

    if (!parsedVariantId) {
      return res.status(400).json({
        success: false,
        message: "Valid variantId is required",
      });
    }

    const movementType = String(type || "")
      .trim()
      .toUpperCase();

    if (!ALL_MOVEMENT_TYPES.includes(movementType)) {
      return res.status(400).json({
        success: false,
        message:
          "type must be OPENING, PURCHASE, SALE, RETURN_IN, RETURN_OUT, or ADJUSTMENT",
      });
    }

    const quantityError = validateQuantity(
      movementType,
      quantity
    );

    if (quantityError) {
      return res.status(400).json({
        success: false,
        message: quantityError,
      });
    }

    const numericQuantity = Number(quantity);

    const variant =
      await stockMovementService.getVariant(
        parsedVariantId
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    if (!variant.is_active) {
      return res.status(400).json({
        success: false,
        message: "Product variant is inactive",
      });
    }

    let parsedRefId = null;

    if (refId !== undefined && refId !== null && refId !== "") {
      parsedRefId = Number(refId);

      if (
        !Number.isInteger(parsedRefId) ||
        parsedRefId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "refId must be a valid positive integer",
        });
      }
    }

    const movement =
      await stockMovementService.createStockMovement({
        variantId: parsedVariantId,
        type: movementType,
        quantity: numericQuantity,
        refType:
          refType !== null && refType !== undefined
            ? String(refType).trim() || null
            : null,
        refId: parsedRefId,
        note:
          note !== null && note !== undefined
            ? String(note).trim() || null
            : null,
        createdById: req.user?.id || null,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "STOCK_MOVEMENT",
      entityId: movement.id,
      afterData: movement,
      status: "success",
    });

    return res.status(201).json({
      success: true,
      message: "Stock movement created successfully",
      data: movement,
    });
  } catch (error) {
    console.error(
      "Create stock movement error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create stock movement",
      error: error.message,
    });
  }
}

module.exports = {
  getAllStockMovements,
  getStockMovementById,
  getVariantStock,
  getVariantMovements,
  createStockMovement,
};