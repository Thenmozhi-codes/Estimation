const unitService = require("../services/unit.service");
const { createAuditLog } = require("../services/audit.service");

async function getAllUnits(req, res) {
  try {
    const units = await unitService.getAllUnits();

    return res.status(200).json({
      success: true,
      data: units,
    });
  } catch (error) {
    console.error("Get units error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch units",
    });
  }
}

async function getUnitById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit ID",
      });
    }

    const unit = await unitService.getUnitById(id);

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: unit,
    });
  } catch (error) {
    console.error("Get unit error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch unit",
    });
  }
}

async function createUnit(req, res) {
  try {
    const { name, symbol } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Unit name is required",
      });
    }

    const unit = await unitService.createUnit({
      name: String(name).trim(),
      symbol:
        symbol !== undefined && symbol !== null
          ? String(symbol).trim()
          : null,
      createdById: req.user.id,
    });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "units",
      entityId: unit.id,
      beforeData: null,
      afterData: unit,
    });

    return res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data: unit,
    });
  } catch (error) {
    console.error("Create unit error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Unit name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create unit",
    });
  }
}

async function updateUnit(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit ID",
      });
    }

    const existingUnit =
      await unitService.getUnitById(id);

    if (!existingUnit) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    const { name, symbol } = req.body;

    if (name === undefined && symbol === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Unit name cannot be empty",
      });
    }

    const unit = await unitService.updateUnit(id, {
      name:
        name !== undefined
          ? String(name).trim()
          : undefined,
      symbol:
        symbol !== undefined && symbol !== null
          ? String(symbol).trim()
          : symbol,
      updatedById: req.user.id,
    });

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "units",
      entityId: id,
      beforeData: existingUnit,
      afterData: unit,
    });

    return res.status(200).json({
      success: true,
      message: "Unit updated successfully",
      data: unit,
    });
  } catch (error) {
    console.error("Update unit error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Unit name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update unit",
    });
  }
}

async function deleteUnit(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit ID",
      });
    }

    const existingUnit =
      await unitService.getUnitById(id);

    if (!existingUnit) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    const result = await unitService.deleteUnit(id);

    if (
      !result.deleted &&
      result.reason === "UNIT_IN_USE"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This unit cannot be deleted because it is being used by products",
        usageCount: result.usageCount,
      });
    }

    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "units",
      entityId: id,
      beforeData: existingUnit,
      afterData: null,
    });

    return res.status(200).json({
      success: true,
      message: "Unit deleted successfully",
    });
  } catch (error) {
    console.error("Delete unit error:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Unit is being used and cannot be deleted",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete unit",
    });
  }
}

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
};