const attributeService = require("../services/attribute.service");
const { createAuditLog } = require("../services/audit.service");

const VALID_TYPES = ["TEXT", "NUMBER", "SELECT"];

async function getAllAttributes(req, res) {
  try {
    const attributes =
      await attributeService.getAllAttributes();

    return res.status(200).json({
      success: true,
      data: attributes,
    });
  } catch (error) {
    console.error("Get attributes error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attributes",
    });
  }
}

async function getAttributeById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid attribute ID",
      });
    }

    const attribute =
      await attributeService.getAttributeById(id);

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: "Attribute not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: attribute,
    });
  } catch (error) {
    console.error("Get attribute error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attribute",
    });
  }
}

async function createAttribute(req, res) {
  try {
    const {
      name,
      code,
      type = "SELECT",
      isRequired = false,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Attribute name is required",
      });
    }

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: "Attribute code is required",
      });
    }

    const normalizedType =
      String(type).trim().toUpperCase();

    if (!VALID_TYPES.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message:
          "Attribute type must be TEXT, NUMBER, or SELECT",
      });
    }

    const attribute =
      await attributeService.createAttribute({
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        type: normalizedType,
        isRequired: Boolean(isRequired),
        createdById: req.user.id,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "attributes",
      entityId: attribute.id,
      beforeData: null,
      afterData: attribute,
    });

    return res.status(201).json({
      success: true,
      message: "Attribute created successfully",
      data: attribute,
    });
  } catch (error) {
    console.error("Create attribute error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "Attribute name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create attribute",
    });
  }
}

async function updateAttribute(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid attribute ID",
      });
    }

    const existingAttribute =
      await attributeService.getAttributeById(id);

    if (!existingAttribute) {
      return res.status(404).json({
        success: false,
        message: "Attribute not found",
      });
    }

    const {
      name,
      code,
      type,
      isRequired,
      isActive,
    } = req.body;

    if (
      name === undefined &&
      code === undefined &&
      type === undefined &&
      isRequired === undefined &&
      isActive === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one field is required to update",
      });
    }

    if (
      name !== undefined &&
      !String(name).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Attribute name cannot be empty",
      });
    }

    let normalizedType;

    if (type !== undefined) {
      normalizedType =
        String(type).trim().toUpperCase();

      if (!VALID_TYPES.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message:
            "Attribute type must be TEXT, NUMBER, or SELECT",
        });
      }
    }

    const attribute =
      await attributeService.updateAttribute(id, {
        name:
          name !== undefined
            ? String(name).trim()
            : undefined,

        code:
          code !== undefined
            ? String(code).trim().toUpperCase()
            : undefined,

        type: normalizedType,

        isRequired,

        isActive,

        updatedById: req.user.id,
      });

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "attributes",
      entityId: id,
      beforeData: existingAttribute,
      afterData: attribute,
    });

    return res.status(200).json({
      success: true,
      message: "Attribute updated successfully",
      data: attribute,
    });
  } catch (error) {
    console.error("Update attribute error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "Attribute name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update attribute",
    });
  }
}

async function deleteAttribute(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid attribute ID",
      });
    }

    const existingAttribute =
      await attributeService.getAttributeById(id);

    if (!existingAttribute) {
      return res.status(404).json({
        success: false,
        message: "Attribute not found",
      });
    }

    await attributeService.deleteAttribute(
      id,
      req.user.id
    );

    const afterAttribute =
      await attributeService.getAttributeById(id);

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "attributes",
      entityId: id,
      beforeData: existingAttribute,
      afterData: afterAttribute,
    });

    return res.status(200).json({
      success: true,
      message: "Attribute deleted successfully",
    });
  } catch (error) {
    console.error("Delete attribute error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete attribute",
    });
  }
}

module.exports = {
  getAllAttributes,
  getAttributeById,
  createAttribute,
  updateAttribute,
  deleteAttribute,
};