const brandService = require("../services/brand.service");
const { createAuditLog } = require("../services/audit.service");

async function getAllBrands(req, res) {
  try {
    const brands = await brandService.getAllBrands();

    return res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    console.error("Get brands error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch brands",
    });
  }
}

async function getBrandById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    const brand = await brandService.getBrandById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    console.error("Get brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch brand",
    });
  }
}

async function createBrand(req, res) {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Brand name is required",
      });
    }

    const brand = await brandService.createBrand({
      name: String(name).trim(),
      createdById: req.user.id,
    });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "brands",
      entityId: brand.id,
      beforeData: null,
      afterData: brand,
    });

    return res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand,
    });
  } catch (error) {
    console.error("Create brand error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Brand name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create brand",
    });
  }
}

async function updateBrand(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    const existingBrand =
      await brandService.getBrandById(id);

    if (!existingBrand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const { name, isActive } = req.body;

    if (name === undefined && isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Brand name cannot be empty",
      });
    }

    const brand = await brandService.updateBrand(id, {
      name:
        name !== undefined
          ? String(name).trim()
          : undefined,
      isActive,
      updatedById: req.user.id,
    });

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "brands",
      entityId: id,
      beforeData: existingBrand,
      afterData: brand,
    });

    return res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand,
    });
  } catch (error) {
    console.error("Update brand error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Brand name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update brand",
    });
  }
}

async function deleteBrand(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    const existingBrand =
      await brandService.getBrandById(id);

    if (!existingBrand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    await brandService.deleteBrand(
      id,
      req.user.id
    );

    const afterBrand =
      await brandService.getBrandById(id);

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "brands",
      entityId: id,
      beforeData: existingBrand,
      afterData: afterBrand,
    });

    return res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error("Delete brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete brand",
    });
  }
}

module.exports = {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
};