const priceTierService = require("../services/price-tier.service");

const { createAuditLog } = require("../services/audit.service");


// =====================================================
// GET ALL
// =====================================================
async function getAllPriceTiers(req, res) {
  try {
    const tiers =
      await priceTierService.getAllPriceTiers();

    return res.status(200).json({
      success: true,
      data: tiers,
    });

  } catch (error) {
    console.error("Get price tiers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch price tiers",
    });
  }
}


// =====================================================
// GET BY ID
// =====================================================
async function getPriceTierById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid price tier ID",
      });
    }

    const tier =
      await priceTierService.getPriceTierById(id);

    if (!tier) {
      return res.status(404).json({
        success: false,
        message: "Price tier not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: tier,
    });

  } catch (error) {
    console.error("Get price tier error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch price tier",
    });
  }
}


// =====================================================
// CREATE
// =====================================================
async function createPriceTier(req, res) {
  try {
    const {
      name,
      code,
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Price tier name is required",
      });
    }

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: "Price tier code is required",
      });
    }

    const tier =
      await priceTierService.createPriceTier({
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "price_tiers",
      entityId: tier.id,
      afterData: tier,
    });

    return res.status(201).json({
      success: true,
      message: "Price tier created successfully",
      data: tier,
    });

  } catch (error) {
    console.error("Create price tier error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Price tier name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create price tier",
    });
  }
}


// =====================================================
// UPDATE
// =====================================================
async function updatePriceTier(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid price tier ID",
      });
    }

    const existing =
      await priceTierService.getPriceTierById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Price tier not found",
      });
    }

    const {
      name,
      code,
    } = req.body || {};

    if (
      name !== undefined &&
      !String(name).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Price tier name cannot be empty",
      });
    }

    if (
      code !== undefined &&
      !String(code).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Price tier code cannot be empty",
      });
    }

    const updated =
      await priceTierService.updatePriceTier(
        id,
        {
          name:
            name !== undefined
              ? String(name).trim()
              : undefined,

          code:
            code !== undefined
              ? String(code).trim().toUpperCase()
              : undefined,
        }
      );

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "price_tiers",
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return res.status(200).json({
      success: true,
      message: "Price tier updated successfully",
      data: updated,
    });

  } catch (error) {
    console.error("Update price tier error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Price tier name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update price tier",
    });
  }
}


// =====================================================
// DELETE
// =====================================================
async function deletePriceTier(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid price tier ID",
      });
    }

    const existing =
      await priceTierService.getPriceTierById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Price tier not found",
      });
    }

    await priceTierService.deletePriceTier(id);

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "price_tiers",
      entityId: id,
      beforeData: existing,
      afterData: null,
    });

    return res.status(200).json({
      success: true,
      message: "Price tier deleted successfully",
    });

  } catch (error) {
    console.error("Delete price tier error:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete price tier because it is already used by a variant",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete price tier",
    });
  }
}


module.exports = {
  getAllPriceTiers,
  getPriceTierById,
  createPriceTier,
  updatePriceTier,
  deletePriceTier,
};