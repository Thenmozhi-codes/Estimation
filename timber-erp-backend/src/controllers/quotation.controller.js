const quotationService = require("../services/quotation.service");
const { createAuditLog } = require("../services/audit.service");

const VALID_STATUSES =
  quotationService.VALID_STATUSES;

function validId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "At least one quotation item is required";
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

async function getAllQuotations(req, res) {
  try {
    const partyId = req.query.partyId
      ? validId(req.query.partyId)
      : null;

    if (req.query.partyId && !partyId) {
      return res.status(400).json({
        success: false,
        message: "Invalid partyId",
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
          message: "Invalid quotation status",
        });
      }
    }

    const quotations =
      await quotationService.getAllQuotations({
        partyId,
        status,
      });

    return res.status(200).json({
      success: true,
      data: quotations,
    });
  } catch (error) {
    console.error(
      "Get quotations error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch quotations",
    });
  }
}

async function getQuotationById(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID",
      });
    }

    const quotation =
      await quotationService.getQuotationById(id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    console.error(
      "Get quotation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch quotation",
    });
  }
}

async function createQuotation(req, res) {
  try {
    const {
      quotationNo,
      partyId,
      quotationDate = null,
      validUntil = null,
      discount = 0,
      notes = null,
      items,
    } = req.body;

    if (
      !quotationNo ||
      typeof quotationNo !== "string" ||
      !quotationNo.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "quotationNo is required",
      });
    }

    const parsedPartyId = validId(partyId);

    if (!parsedPartyId) {
      return res.status(400).json({
        success: false,
        message: "Valid partyId is required",
      });
    }

    const itemError = validateItems(items);

    if (itemError) {
      return res.status(400).json({
        success: false,
        message: itemError,
      });
    }

    const customer =
      await quotationService.getCustomer(
        parsedPartyId
      );

    if (!customer) {
      return res.status(400).json({
        success: false,
        message:
          "Customer not found or party is not CUSTOMER/BOTH",
      });
    }

    if (!customer.is_active) {
      return res.status(400).json({
        success: false,
        message: "Customer is inactive",
      });
    }

    const quotation =
      await quotationService.createQuotation({
        quotationNo: quotationNo.trim(),
        partyId: parsedPartyId,
        quotationDate,
        validUntil,
        discount,
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
      entity: "QUOTATION",
      entityId: quotation.id,
      afterData: quotation,
      status: "success",
    });

    return res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      data: quotation,
    });
  } catch (error) {
    console.error(
      "Create quotation error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Quotation number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create quotation",
      error: error.message,
    });
  }
}

async function updateQuotation(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID",
      });
    }

    const existing =
      await quotationService.getQuotationById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    if (existing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message:
          "Only DRAFT quotations can be edited",
      });
    }

    const {
      partyId,
      quotationDate = null,
      validUntil = null,
      discount = 0,
      notes = null,
      items,
    } = req.body;

    const parsedPartyId = validId(partyId);

    if (!parsedPartyId) {
      return res.status(400).json({
        success: false,
        message: "Valid partyId is required",
      });
    }

    const itemError = validateItems(items);

    if (itemError) {
      return res.status(400).json({
        success: false,
        message: itemError,
      });
    }

    const customer =
      await quotationService.getCustomer(
        parsedPartyId
      );

    if (!customer) {
      return res.status(400).json({
        success: false,
        message:
          "Customer not found or party is not CUSTOMER/BOTH",
      });
    }

    if (!customer.is_active) {
      return res.status(400).json({
        success: false,
        message: "Customer is inactive",
      });
    }

    const updated =
      await quotationService.updateQuotation(
        id,
        {
          partyId: parsedPartyId,
          quotationDate,
          validUntil,
          discount,
          notes,
          items,
        }
      );

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "QUOTATION",
      entityId: id,
      beforeData: existing,
      afterData: updated,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Quotation updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update quotation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update quotation",
      error: error.message,
    });
  }
}

async function changeQuotationStatus(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID",
      });
    }

    const newStatus = String(
      req.body.status || ""
    )
      .trim()
      .toUpperCase();

    if (!VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation status",
      });
    }

    const existing =
      await quotationService.getQuotationById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    const updated =
      await quotationService.changeStatus(
        id,
        newStatus
      );

    await createAuditLog({
      req,
      action: "STATUS_CHANGE",
      entity: "QUOTATION",
      entityId: id,
      beforeData: existing,
      afterData: updated,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message:
        "Quotation status updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(
      "Change quotation status error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  changeQuotationStatus,
};