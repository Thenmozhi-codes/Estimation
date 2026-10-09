const categoryService = require("../services/category.service");
const { createAuditLog } = require("../services/audit.service");

async function getAllCategories(req, res) {
  try {
    const categories = await categoryService.getAllCategories();

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
}

async function getCategoryById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await categoryService.getCategoryById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Get category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch category",
    });
  }
}

async function createCategory(req, res) {
  try {
    const { name, code } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category code is required",
      });
    }

    const category = await categoryService.createCategory({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      createdById: req.user.id,
    });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "categories",
      entityId: category.id,
      beforeData: null,
      afterData: category,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Create category error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Category name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
}

async function updateCategory(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const existingCategory =
      await categoryService.getCategoryById(id);

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const { name, code, isActive } = req.body;

    if (
      name === undefined &&
      code === undefined &&
      isActive === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name cannot be empty",
      });
    }

    if (code !== undefined && !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: "Category code cannot be empty",
      });
    }

    const category = await categoryService.updateCategory(id, {
      name:
        name !== undefined
          ? String(name).trim()
          : undefined,
      code:
        code !== undefined
          ? String(code).trim().toUpperCase()
          : undefined,
      isActive,
      updatedById: req.user.id,
    });

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "categories",
      entityId: id,
      beforeData: existingCategory,
      afterData: category,
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Update category error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Category name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
}

async function deleteCategory(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const existingCategory =
      await categoryService.getCategoryById(id);

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await categoryService.deleteCategory(
      id,
      req.user.id
    );

    const afterCategory =
      await categoryService.getCategoryById(id);

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "categories",
      entityId: id,
      beforeData: existingCategory,
      afterData: afterCategory,
    });

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};