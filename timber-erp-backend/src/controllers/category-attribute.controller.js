const categoryAttributeService = require("../services/category-attribute.service");
const categoryService = require("../services/category.service");
const attributeService = require("../services/attribute.service");
const { createAuditLog } = require("../services/audit.service");

async function getCategoryAttributes(req, res) {
  try {
    const categoryId = Number(req.params.categoryId);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category =
      await categoryService.getCategoryById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const attributes =
      await categoryAttributeService.getCategoryAttributes(
        categoryId
      );

    return res.status(200).json({
      success: true,
      data: attributes,
    });
  } catch (error) {
    console.error(
      "Get category attributes error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch category attributes",
    });
  }
}

async function assignAttribute(req, res) {
  try {
    const categoryId = Number(req.params.categoryId);
    const attributeId = Number(req.body.attributeId);

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (
      !Number.isInteger(attributeId) ||
      attributeId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid attribute ID is required",
      });
    }

    const category =
      await categoryService.getCategoryById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const attribute =
      await attributeService.getAttributeById(attributeId);

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: "Attribute not found",
      });
    }

    const isRequired =
      req.body.isRequired === undefined
        ? false
        : Boolean(req.body.isRequired);

    const sortOrder =
      req.body.sortOrder === undefined
        ? 0
        : Number(req.body.sortOrder);

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Sort order must be a non-negative integer",
      });
    }

    const mapping =
      await categoryAttributeService.assignAttributeToCategory({
        categoryId,
        attributeId,
        isRequired,
        sortOrder,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "category_attributes",
      entityId: `${categoryId}:${attributeId}`,
      beforeData: null,
      afterData: mapping,
    });

    return res.status(201).json({
      success: true,
      message: "Attribute assigned to category successfully",
      data: mapping,
    });
  } catch (error) {
    console.error(
      "Assign category attribute error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "This attribute is already assigned to this category",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to assign attribute",
    });
  }
}

async function updateCategoryAttribute(req, res) {
  try {
    const categoryId = Number(req.params.categoryId);
    const attributeId = Number(req.params.attributeId);

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0 ||
      !Number.isInteger(attributeId) ||
      attributeId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category or attribute ID",
      });
    }

    const existingRows =
      await categoryAttributeService.getCategoryAttributes(
        categoryId
      );

    const existing =
      existingRows.find(
        (item) =>
          Number(item.attribute_id) === attributeId
      );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "Attribute is not assigned to this category",
      });
    }

    const isRequired =
      req.body.isRequired === undefined
        ? existing.is_required
        : Boolean(req.body.isRequired);

    const sortOrder =
      req.body.sortOrder === undefined
        ? existing.sort_order
        : Number(req.body.sortOrder);

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Sort order must be a non-negative integer",
      });
    }

    const updated =
      await categoryAttributeService.updateCategoryAttribute({
        categoryId,
        attributeId,
        isRequired,
        sortOrder,
      });

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "category_attributes",
      entityId: `${categoryId}:${attributeId}`,
      beforeData: existing,
      afterData: updated,
    });

    return res.status(200).json({
      success: true,
      message:
        "Category attribute updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update category attribute error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update category attribute",
    });
  }
}

async function removeAttribute(req, res) {
  try {
    const categoryId = Number(req.params.categoryId);
    const attributeId = Number(req.params.attributeId);

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0 ||
      !Number.isInteger(attributeId) ||
      attributeId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category or attribute ID",
      });
    }

    const existingRows =
      await categoryAttributeService.getCategoryAttributes(
        categoryId
      );

    const existing =
      existingRows.find(
        (item) =>
          Number(item.attribute_id) === attributeId
      );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "Attribute is not assigned to this category",
      });
    }

    await categoryAttributeService.removeAttributeFromCategory(
      categoryId,
      attributeId
    );

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "category_attributes",
      entityId: `${categoryId}:${attributeId}`,
      beforeData: existing,
      afterData: null,
    });

    return res.status(200).json({
      success: true,
      message:
        "Attribute removed from category successfully",
    });
  } catch (error) {
    console.error(
      "Remove category attribute error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to remove attribute from category",
    });
  }
}

module.exports = {
  getCategoryAttributes,
  assignAttribute,
  updateCategoryAttribute,
  removeAttribute,
};