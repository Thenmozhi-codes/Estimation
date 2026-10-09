const auditService = require("../services/audit.service");

async function getAllAuditLogs(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      entity = null,
      action = null,
      userId = null,
    } = req.query;

    const result = await auditService.getAllAuditLogs({
      page,
      limit,
      entity,
      action,
      userId,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get audit logs error:", error);

    if (error.message === "Invalid userId") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
}

module.exports = {
  getAllAuditLogs,
};