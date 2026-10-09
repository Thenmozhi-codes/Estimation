const paymentService = require("../services/payment.service");
const { createAuditLog } = require("../services/audit.service");

function validId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

async function getAllPayments(req, res) {
  try {
    const partyId = req.query.partyId
      ? validId(req.query.partyId)
      : null;

    const invoiceId = req.query.invoiceId
      ? validId(req.query.invoiceId)
      : null;

    const purchaseId = req.query.purchaseId
      ? validId(req.query.purchaseId)
      : null;

    if (req.query.partyId && !partyId) {
      return res.status(400).json({
        success: false,
        message: "Invalid partyId",
      });
    }

    if (req.query.invoiceId && !invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoiceId",
      });
    }

    if (req.query.purchaseId && !purchaseId) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchaseId",
      });
    }

    let direction = null;

    if (req.query.direction) {
      direction = String(
        req.query.direction
      )
        .trim()
        .toUpperCase();

      if (
        !paymentService.VALID_DIRECTIONS.includes(
          direction
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment direction",
        });
      }
    }

    const payments =
      await paymentService.getAllPayments({
        partyId,
        direction,
        invoiceId,
        purchaseId,
      });

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error(
      "Get payments error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
}

async function getPaymentById(req, res) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const payment =
      await paymentService.getPaymentById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error(
      "Get payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment",
    });
  }
}

async function createPayment(req, res) {
  try {
    const {
      paymentNo,
      partyId,
      direction,
      quotationId = null,
      invoiceId = null,
      purchaseId = null,
      amount,
      method = "CASH",
      reference = null,
      paidAt = null,
      notes = null,
    } = req.body;

    if (
      !paymentNo ||
      typeof paymentNo !== "string" ||
      !paymentNo.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "paymentNo is required",
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

    const normalizedDirection =
      String(direction || "")
        .trim()
        .toUpperCase();

    if (
      !paymentService.VALID_DIRECTIONS.includes(
        normalizedDirection
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "direction must be RECEIVED or PAID",
      });
    }

    const normalizedMethod =
      String(method || "CASH")
        .trim()
        .toUpperCase();

    if (
      !paymentService.VALID_METHODS.includes(
        normalizedMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than 0",
      });
    }

    const parsedInvoiceId =
      invoiceId !== null &&
      invoiceId !== undefined &&
      invoiceId !== ""
        ? validId(invoiceId)
        : null;

    const parsedPurchaseId =
      purchaseId !== null &&
      purchaseId !== undefined &&
      purchaseId !== ""
        ? validId(purchaseId)
        : null;

    const parsedQuotationId =
      quotationId !== null &&
      quotationId !== undefined &&
      quotationId !== ""
        ? validId(quotationId)
        : null;

    if (invoiceId && !parsedInvoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoiceId",
      });
    }

    if (purchaseId && !parsedPurchaseId) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchaseId",
      });
    }

    if (quotationId && !parsedQuotationId) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotationId",
      });
    }

    if (
      normalizedDirection === "RECEIVED" &&
      !parsedInvoiceId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "invoiceId is required for RECEIVED payment",
      });
    }

    if (
      normalizedDirection === "PAID" &&
      !parsedPurchaseId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "purchaseId is required for PAID payment",
      });
    }

    const payment =
      await paymentService.createPayment({
        paymentNo: paymentNo.trim(),
        partyId: parsedPartyId,
        direction: normalizedDirection,
        quotationId: parsedQuotationId,
        invoiceId: parsedInvoiceId,
        purchaseId: parsedPurchaseId,
        amount: numericAmount,
        method: normalizedMethod,
        reference:
          reference !== null &&
          reference !== undefined
            ? String(reference).trim() || null
            : null,
        paidAt,
        notes:
          notes !== null &&
          notes !== undefined
            ? String(notes).trim() || null
            : null,
        createdById:
          req.user?.id || null,
      });

    await createAuditLog({
      req,
      action: "CREATE",
      entity: "PAYMENT",
      entityId: payment.id,
      afterData: payment,
      status: "success",
    });

    return res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: payment,
    });
  } catch (error) {
    console.error(
      "Create payment error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Payment number already exists",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function getPartyOutstanding(req, res) {
  try {
    const partyId =
      validId(req.params.partyId);

    if (!partyId) {
      return res.status(400).json({
        success: false,
        message: "Invalid party ID",
      });
    }

    const outstanding =
      await paymentService.getPartyOutstanding(
        partyId
      );

    if (!outstanding) {
      return res.status(404).json({
        success: false,
        message: "Party not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: outstanding,
    });
  } catch (error) {
    console.error(
      "Get outstanding error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch party outstanding",
    });
  }
}

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
  getPartyOutstanding,
};