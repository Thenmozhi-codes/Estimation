const partyService = require("../services/party.service");
const { createAuditLog } = require("../services/audit.service");

const VALID_PARTY_TYPES = [
  "CUSTOMER",
  "SUPPLIER",
  "BOTH",
];

function isValidEmail(email) {
  if (!email) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePartyData(body, isUpdate = false) {
  const {
    partyType,
    name,
    email,
    creditLimit,
    isActive,
  } = body;

  if (!isUpdate || partyType !== undefined) {
    if (!VALID_PARTY_TYPES.includes(partyType)) {
      return "partyType must be CUSTOMER, SUPPLIER, or BOTH";
    }
  }

  if (!isUpdate || name !== undefined) {
    if (
      !name ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return "Party name is required";
    }
  }

  if (email !== undefined && email !== null && email !== "") {
    if (!isValidEmail(email)) {
      return "Invalid email format";
    }
  }

  if (
    creditLimit !== undefined &&
    creditLimit !== null &&
    creditLimit !== ""
  ) {
    const numericCreditLimit = Number(creditLimit);

    if (
      !Number.isFinite(numericCreditLimit) ||
      numericCreditLimit < 0
    ) {
      return "creditLimit must be a valid non-negative number";
    }
  }

  if (
    isActive !== undefined &&
    typeof isActive !== "boolean"
  ) {
    return "isActive must be a boolean";
  }

  return null;
}

async function getAllParties(req, res) {
  try {
    const { type, search } = req.query;

    let partyType = null;

    if (type) {
      const normalizedType = String(type).trim().toUpperCase();

      if (!VALID_PARTY_TYPES.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message:
            "type must be CUSTOMER, SUPPLIER, or BOTH",
        });
      }

      partyType = normalizedType;
    }

    const parties = await partyService.getAllParties({
      partyType,
      search: search ? String(search).trim() : null,
    });

    return res.status(200).json({
      success: true,
      data: parties,
    });
  } catch (error) {
    console.error("Get parties error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch parties",
    });
  }
}

async function getPartyById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid party ID",
      });
    }

    const party = await partyService.getPartyById(id);

    if (!party) {
      return res.status(404).json({
        success: false,
        message: "Party not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: party,
    });
  } catch (error) {
    console.error("Get party error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch party",
    });
  }
}

async function createParty(req, res) {
  try {
    const validationError = validatePartyData(
      req.body,
      false
    );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const party = await partyService.createParty({
      partyType: req.body.partyType,
      name: req.body.name.trim(),
      phone:
        req.body.phone !== undefined &&
        req.body.phone !== null
          ? String(req.body.phone).trim() || null
          : null,
      email:
        req.body.email !== undefined &&
        req.body.email !== null
          ? String(req.body.email).trim().toLowerCase() ||
            null
          : null,
      gstin:
        req.body.gstin !== undefined &&
        req.body.gstin !== null
          ? String(req.body.gstin).trim().toUpperCase() ||
            null
          : null,
      addressLine:
        req.body.addressLine !== undefined &&
        req.body.addressLine !== null
          ? String(req.body.addressLine).trim() || null
          : null,
      city:
        req.body.city !== undefined &&
        req.body.city !== null
          ? String(req.body.city).trim() || null
          : null,
      state:
        req.body.state !== undefined &&
        req.body.state !== null
          ? String(req.body.state).trim() || null
          : null,
      pincode:
        req.body.pincode !== undefined &&
        req.body.pincode !== null
          ? String(req.body.pincode).trim() || null
          : null,
      creditLimit:
        req.body.creditLimit !== undefined &&
        req.body.creditLimit !== null &&
        req.body.creditLimit !== ""
          ? Number(req.body.creditLimit)
          : null,
    });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "PARTY",
      entityId: party.id,
      afterData: party,
      status: "success",
    });

    return res.status(201).json({
      success: true,
      message: "Party created successfully",
      data: party,
    });
  } catch (error) {
    console.error("Create party error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create party",
      error: error.message,
    });
  }
}

async function updateParty(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid party ID",
      });
    }

    const validationError = validatePartyData(
      req.body,
      true
    );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const existingParty = await partyService.getPartyById(id);

    if (!existingParty) {
      return res.status(404).json({
        success: false,
        message: "Party not found",
      });
    }

    const updateData = {};

    if (req.body.partyType !== undefined) {
      updateData.partyType = req.body.partyType;
    }

    if (req.body.name !== undefined) {
      updateData.name = req.body.name.trim();
    }

    if (req.body.phone !== undefined) {
      updateData.phone =
        req.body.phone === null
          ? null
          : String(req.body.phone).trim() || null;
    }

    if (req.body.email !== undefined) {
      updateData.email =
        req.body.email === null
          ? null
          : String(req.body.email).trim().toLowerCase() ||
            null;
    }

    if (req.body.gstin !== undefined) {
      updateData.gstin =
        req.body.gstin === null
          ? null
          : String(req.body.gstin).trim().toUpperCase() ||
            null;
    }

    if (req.body.addressLine !== undefined) {
      updateData.addressLine =
        req.body.addressLine === null
          ? null
          : String(req.body.addressLine).trim() || null;
    }

    if (req.body.city !== undefined) {
      updateData.city =
        req.body.city === null
          ? null
          : String(req.body.city).trim() || null;
    }

    if (req.body.state !== undefined) {
      updateData.state =
        req.body.state === null
          ? null
          : String(req.body.state).trim() || null;
    }

    if (req.body.pincode !== undefined) {
      updateData.pincode =
        req.body.pincode === null
          ? null
          : String(req.body.pincode).trim() || null;
    }

    if (req.body.creditLimit !== undefined) {
      updateData.creditLimit =
        req.body.creditLimit === null ||
        req.body.creditLimit === ""
          ? null
          : Number(req.body.creditLimit);
    }

    if (req.body.isActive !== undefined) {
      updateData.isActive = req.body.isActive;
    }

    const updatedParty = await partyService.updateParty(
      id,
      updateData
    );

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "PARTY",
      entityId: id,
      beforeData: existingParty,
      afterData: updatedParty,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Party updated successfully",
      data: updatedParty,
    });
  } catch (error) {
    console.error("Update party error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update party",
      error: error.message,
    });
  }
}

async function deleteParty(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid party ID",
      });
    }

    const existingParty = await partyService.getPartyById(id);

    if (!existingParty) {
      return res.status(404).json({
        success: false,
        message: "Party not found",
      });
    }

    if (!existingParty.is_active) {
      return res.status(400).json({
        success: false,
        message: "Party is already inactive",
      });
    }

    const deletedParty =
      await partyService.deleteParty(id);

    await createAuditLog({
      req,
      action: "DELETE",
      entity: "PARTY",
      entityId: id,
      beforeData: existingParty,
      afterData: deletedParty,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Party deactivated successfully",
      data: deletedParty,
    });
  } catch (error) {
    console.error("Delete party error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete party",
      error: error.message,
    });
  }
}

module.exports = {
  getAllParties,
  getPartyById,
  createParty,
  updateParty,
  deleteParty,
};