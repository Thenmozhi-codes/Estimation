const reportService = require("../services/report.service");

async function getDashboard(req, res) {
  try {
    const data = await reportService.getDashboard();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Dashboard report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard report",
    });
  }
}

async function getSalesSummary(req, res) {
  try {
    const { from, to } = req.query;

    const data = await reportService.getSalesSummary({
      from,
      to,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Sales report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales report",
    });
  }
}

async function getPurchaseSummary(req, res) {
  try {
    const { from, to } = req.query;

    const data = await reportService.getPurchaseSummary({
      from,
      to,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Purchase report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase report",
    });
  }
}

async function getStockSummary(req, res) {
  try {
    const data = await reportService.getStockSummary();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Stock report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock report",
    });
  }
}

async function getOutstandingSummary(req, res) {
  try {
    const data = await reportService.getOutstandingSummary();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Outstanding report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch outstanding report",
    });
  }
}

module.exports = {
  getDashboard,
  getSalesSummary,
  getPurchaseSummary,
  getStockSummary,
  getOutstandingSummary,
};