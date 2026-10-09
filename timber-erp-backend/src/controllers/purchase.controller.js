const purchaseService = require("../services/purchase.service");
const { createAuditLog } = require("../services/audit.service");

const VALID_STATUSES =
  purchaseService.VALID_STATUSES;

function validId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "At least one purchase item is required";
  }

  for (const item of items) {
    if (!validId(item.variantId)) {
      return "Each item requires a valid variantId";
    }

    if (!validId(item.unitId)) {
      return "Each item requires a valid unitId";
    }

    const quantity = Number(item.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "Each item quantity must be greater than 0";
    }

    const unitPrice = Number(item.unitPrice);

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return "Each item unitPrice must be 0 or greater";
    }

    const taxRate = Number(item.taxRate || 0);

    if (
      !Number.isFinite(taxRate) ||
      taxRate < 0 ||
      taxRate > 100
    ) {
      return "Each item taxRate must be between 0 and 100";
    }
  }

  return null;
}

async function getAllPurchases(req, res) {
  try {
    const supplierId = req.query.supplierId
      ? validId(req.query.supplierId)
      : null;

    if (req.query.supplierId && !supplierId) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplierId",
      });
    }

    let status = null;

    if (req.query.status) {
      status = String(req.query.status)
        .trim()
        .toUpperCase();

      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid purchase status",
        });
      }
    }

    const purchases =
      await purchaseService.getAllPurchases({
        supplierId,
        status,
      });

    return res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    console.error(
      "Get purchases error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchases",
    });
  }
}

async function getPurchaseById(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    const purchase =
      await purchaseService.getPurchaseById(id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error(
      "Get purchase error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase",
    });
  }
}

async function createPurchase(req, res) {
  try {
    const {
      purchaseNo,
      supplierId,
      supplierBillNo = null,
      purchaseDate = null,
      notes = null,
      items,
    } = req.body;

    if (
      !purchaseNo ||
      typeof purchaseNo !== "string" ||
      !purchaseNo.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "purchaseNo is required",
      });
    }

    const parsedSupplierId =
      validId(supplierId);

    if (!parsedSupplierId) {
      return res.status(400).json({
        success: false,
        message: "Valid supplierId is required",
      });
    }

    const itemError = validateItems(items);

    if (itemError) {
      return res.status(400).json({
        success: false,
        message: itemError,
      });
    }

    const supplier =
      await purchaseService.getSupplier(
        parsedSupplierId
      );

    if (!supplier) {
      return res.status(400).json({
        success: false,
        message:
          "Supplier not found or party is not a SUPPLIER/BOTH",
      });
    }

    if (!supplier.is_active) {
      return res.status(400).json({
        success: false,
        message: "Supplier is inactive",
      });
    }

    const purchase =
      await purchaseService.createPurchase({
        purchaseNo: purchaseNo.trim(),
        supplierId: parsedSupplierId,
        supplierBillNo:
          supplierBillNo
            ? String(supplierBillNo).trim()
            : null,
        purchaseDate,
        notes:
          notes !== null && notes !== undefined
            ? String(notes).trim() || null
            : null,
        items,
        createdById: req.user?.id || null,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "PURCHASE",
      entityId: purchase.id,
      afterData: purchase,
      status: "success",
    });

    return res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      data: purchase,
    });
  } catch (error) {
    console.error(
      "Create purchase error:",
      error
    );

    if (
      error.code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Purchase number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create purchase",
      error: error.message,
    });
  }
}

async function updatePurchase(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    const existing =
      await purchaseService.getPurchaseById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    if (existing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message:
          "Only DRAFT purchases can be edited",
      });
    }

    const {
      supplierId,
      supplierBillNo = null,
      purchaseDate = null,
      notes = null,
      items,
    } = req.body;

    const parsedSupplierId =
      validId(supplierId);

    if (!parsedSupplierId) {
      return res.status(400).json({
        success: false,
        message: "Valid supplierId is required",
      });
    }

    const itemError = validateItems(items);

    if (itemError) {
      return res.status(400).json({
        success: false,
        message: itemError,
      });
    }

    const supplier =
      await purchaseService.getSupplier(
        parsedSupplierId
      );

    if (!supplier) {
      return res.status(400).json({
        success: false,
        message:
          "Supplier not found or party is not a SUPPLIER/BOTH",
      });
    }

    if (!supplier.is_active) {
      return res.status(400).json({
        success: false,
        message: "Supplier is inactive",
      });
    }

    const updated =
      await purchaseService.updatePurchase(
        id,
        {
          supplierId: parsedSupplierId,
          supplierBillNo:
            supplierBillNo
              ? String(supplierBillNo).trim()
              : null,
          purchaseDate,
          notes:
            notes !== null && notes !== undefined
              ? String(notes).trim() || null
              : null,
          items,
        }
      );

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "PURCHASE",
      entityId: id,
      beforeData: existing,
      afterData: updated,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Purchase updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update purchase error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update purchase",
      error: error.message,
    });
  }
}

async function receivePurchase(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    const existing =
      await purchaseService.getPurchaseById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    const received =
      await purchaseService.receivePurchase(
        id,
        req.user?.id || null
      );

    await createAuditLog({
      req,
      action: "RECEIVE",
      entity: "PURCHASE",
      entityId: id,
      beforeData: existing,
      afterData: received,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message:
        "Purchase received and stock updated successfully",
      data: received,
    });
  } catch (error) {
    console.error(
      "Receive purchase error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function cancelPurchase(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    const existing =
      await purchaseService.getPurchaseById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    const cancelled =
      await purchaseService.cancelPurchase(id);

    await createAuditLog({
      req,
      action: "CANCEL",
      entity: "PURCHASE",
      entityId: id,
      beforeData: existing,
      afterData: cancelled,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Purchase cancelled successfully",
      data: cancelled,
    });
  } catch (error) {
    console.error(
      "Cancel purchase error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  receivePurchase,
  cancelPurchase,
};