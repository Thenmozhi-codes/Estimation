const attributeValueService = require("../services/attribute-value.service");
const attributeService = require("../services/attribute.service");
const { createAuditLog } = require("../services/audit.service");

async function getAllAttributeValues(req, res) {
  try {
    const attributeId = Number(req.params.attributeId);

    if (!Number.isInteger(attributeId) || attributeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid attribute ID",
      });
    }

    const attribute =
      await attributeService.getAttributeById(
        attributeId
      );

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: "Attribute not found",
      });
    }

    const values =
      await attributeValueService.getAllAttributeValues(
        attributeId
      );

    return res.status(200).json({
      success: true,
      data: values,
    });
  } catch (error) {
    console.error(
      "Get attribute values error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attribute values",
    });
  }
}

async function getAttributeValueById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid attribute value ID",
      });
    }

    const value =
      await attributeValueService.getAttributeValueById(
        id
      );

    if (!value) {
      return res.status(404).json({
        success: false,
        message: "Attribute value not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: value,
    });
  } catch (error) {
    console.error(
      "Get attribute value error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attribute value",
    });
  }
}

async function createAttributeValue(req, res) {
  try {
    const attributeId = Number(
      req.params.attributeId
    );

    if (!Number.isInteger(attributeId) || attributeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid attribute ID",
      });
    }

    const attribute =
      await attributeService.getAttributeById(
        attributeId
      );

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: "Attribute not found",
      });
    }

    if (attribute.type !== "SELECT") {
      return res.status(400).json({
        success: false,
        message:
          "Attribute values can only be added to SELECT attributes",
      });
    }

    const { value, sortOrder = 0 } = req.body;

    if (!value || !String(value).trim()) {
      return res.status(400).json({
        success: false,
        message: "Attribute value is required",
      });
    }

    const numericSortOrder = Number(sortOrder);

    if (
      !Number.isInteger(numericSortOrder) ||
      numericSortOrder < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Sort order must be a non-negative integer",
      });
    }

    const attributeValue =
      await attributeValueService.createAttributeValue({
        attributeId,
        value: String(value).trim(),
        sortOrder: numericSortOrder,
        createdById: req.user.id,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "attribute_values",
      entityId: attributeValue.id,
      beforeData: null,
      afterData: attributeValue,
    });

    return res.status(201).json({
      success: true,
      message: "Attribute value created successfully",
      data: attributeValue,
    });
  } catch (error) {
    console.error(
      "Create attribute value error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "This value already exists for the attribute",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create attribute value",
    });
  }
}

async function updateAttributeValue(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid attribute value ID",
      });
    }

    const existingValue =
      await attributeValueService.getAttributeValueById(
        id
      );

    if (!existingValue) {
      return res.status(404).json({
        success: false,
        message: "Attribute value not found",
      });
    }

    const { value, sortOrder } = req.body;

    if (
      value === undefined &&
      sortOrder === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one field is required to update",
      });
    }

    if (
      value !== undefined &&
      !String(value).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Attribute value cannot be empty",
      });
    }

    let numericSortOrder;

    if (sortOrder !== undefined) {
      numericSortOrder = Number(sortOrder);

      if (
        !Number.isInteger(numericSortOrder) ||
        numericSortOrder < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Sort order must be a non-negative integer",
        });
      }
    }

    const updatedValue =
      await attributeValueService.updateAttributeValue(
        id,
        {
          value:
            value !== undefined
              ? String(value).trim()
              : undefined,
          sortOrder: numericSortOrder,
          updatedById: req.user.id,
        }
      );

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "attribute_values",
      entityId: id,
      beforeData: existingValue,
      afterData: updatedValue,
    });

    return res.status(200).json({
      success: true,
      message: "Attribute value updated successfully",
      data: updatedValue,
    });
  } catch (error) {
    console.error(
      "Update attribute value error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "This value already exists for the attribute",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update attribute value",
    });
  }
}

async function deleteAttributeValue(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid attribute value ID",
      });
    }

    const existingValue =
      await attributeValueService.getAttributeValueById(
        id
      );

    if (!existingValue) {
      return res.status(404).json({
        success: false,
        message: "Attribute value not found",
      });
    }

    await attributeValueService.deleteAttributeValue(id);

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "attribute_values",
      entityId: id,
      beforeData: existingValue,
      afterData: null,
    });

    return res.status(200).json({
      success: true,
      message: "Attribute value deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete attribute value error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete attribute value",
    });
  }
}

module.exports = {
  getAllAttributeValues,
  getAttributeValueById,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
};