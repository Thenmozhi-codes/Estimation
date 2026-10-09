const invoiceService = require("../services/invoice.service");
const { createAuditLog } = require("../services/audit.service");

const VALID_STATUSES =
  invoiceService.VALID_STATUSES;

function validId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "At least one invoice item is required";
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

async function getAllInvoices(req, res) {
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
          message: "Invalid invoice status",
        });
      }
    }

    const invoices =
      await invoiceService.getAllInvoices({
        partyId,
        status,
      });

    return res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    console.error(
      "Get invoices error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoices",
    });
  }
}

async function getInvoiceById(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID",
      });
    }

    const invoice =
      await invoiceService.getInvoiceById(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error(
      "Get invoice error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice",
    });
  }
}

async function createInvoice(req, res) {
  try {
    const {
      invoiceNo,
      quotationId = null,
      partyId,
      invoiceDate = null,
      dueDate = null,
      discount = 0,
      notes = null,
      items,
    } = req.body;

    if (
      !invoiceNo ||
      typeof invoiceNo !== "string" ||
      !invoiceNo.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "invoiceNo is required",
      });
    }

    const parsedPartyId =
      validId(partyId);

    if (!parsedPartyId) {
      return res.status(400).json({
        success: false,
        message: "Valid partyId is required",
      });
    }

    const itemError =
      validateItems(items);

    if (itemError) {
      return res.status(400).json({
        success: false,
        message: itemError,
      });
    }

    const customer =
      await invoiceService.getCustomer(
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

    let parsedQuotationId = null;

    if (
      quotationId !== null &&
      quotationId !== undefined &&
      quotationId !== ""
    ) {
      parsedQuotationId =
        validId(quotationId);

      if (!parsedQuotationId) {
        return res.status(400).json({
          success: false,
          message: "Invalid quotationId",
        });
      }

      const quotation =
        await invoiceService.getQuotationForInvoice(
          parsedQuotationId
        );

      if (!quotation) {
        return res.status(404).json({
          success: false,
          message: "Quotation not found",
        });
      }

      if (quotation.party_id !== parsedPartyId) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice customer does not match quotation customer",
        });
      }

      if (quotation.status !== "APPROVED") {
        return res.status(400).json({
          success: false,
          message:
            "Only APPROVED quotations can be converted to an invoice",
        });
      }
    }

    const invoice =
      await invoiceService.createInvoice({
        invoiceNo: invoiceNo.trim(),
        quotationId: parsedQuotationId,
        partyId: parsedPartyId,

        partyName: customer.name,
        partyGstin: customer.gstin,
        partyAddress: customer.address_line,

        invoiceDate,
        dueDate,
        discount,
        notes:
          notes !== null && notes !== undefined
            ? String(notes).trim() || null
            : null,

        items,

        createdById:
          req.user?.id || null,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "INVOICE",
      entityId: invoice.id,
      afterData: invoice,
      status: "success",
    });

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (error) {
    console.error(
      "Create invoice error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "Invoice number or quotation is already linked to another invoice",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create invoice",
      error: error.message,
    });
  }
}

async function updateInvoice(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID",
      });
    }

    const existing =
      await invoiceService.getInvoiceById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (existing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message:
          "Only DRAFT invoices can be edited",
      });
    }

    const {
      partyId,
      invoiceDate = null,
      dueDate = null,
      discount = 0,
      notes = null,
      items,
    } = req.body;

    const parsedPartyId =
      validId(partyId);

    if (!parsedPartyId) {
      return res.status(400).json({
        success: false,
        message: "Valid partyId is required",
      });
    }

    const itemError =
      validateItems(items);

    if (itemError) {
      return res.status(400).json({
        success: false,
        message: itemError,
      });
    }

    const customer =
      await invoiceService.getCustomer(
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
      await invoiceService.updateInvoice(
        id,
        {
          partyId: parsedPartyId,

          partyName: customer.name,
          partyGstin: customer.gstin,
          partyAddress: customer.address_line,

          invoiceDate,
          dueDate,
          discount,
          notes,
          items,
        }
      );

    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "INVOICE",
      entityId: id,
      beforeData: existing,
      afterData: updated,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(
      "Update invoice error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update invoice",
      error: error.message,
    });
  }
}

async function confirmInvoice(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID",
      });
    }

    const existing =
      await invoiceService.getInvoiceById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const confirmed =
      await invoiceService.confirmInvoice(
        id,
        req.user?.id || null
      );

    await createAuditLog({
      req,
      action: "CONFIRM",
      entity: "INVOICE",
      entityId: id,
      beforeData: existing,
      afterData: confirmed,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message:
        "Invoice confirmed and stock updated successfully",
      data: confirmed,
    });
  } catch (error) {
    console.error(
      "Confirm invoice error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function cancelInvoice(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID",
      });
    }

    const existing =
      await invoiceService.getInvoiceById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const cancelled =
      await invoiceService.cancelInvoice(id);

    await createAuditLog({
      req,
      action: "CANCEL",
      entity: "INVOICE",
      entityId: id,
      beforeData: existing,
      afterData: cancelled,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Invoice cancelled successfully",
      data: cancelled,
    });
  } catch (error) {
    console.error(
      "Cancel invoice error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  confirmInvoice,
  cancelInvoice,
};