const pool = require("../config/db");

async function createAuditLog({
  req,
  action,
  entity,
  entityId,
  changes = null,
  beforeData = null,
  afterData = null,
  status = "success",
}) {
  const user = req.user || {};

  await pool.query(
    `
    INSERT INTO audit_logs (
      request_id,
      user_id,
      user_name,
      user_role,
      ip,
      action,
      entity,
      entity_id,
      changes,
      before_data,
      after_data,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      req.requestId || null,
      user.id || null,
      user.name || null,
      user.roleName || null,
      req.ip || null,
      action,
      entity,
      entityId !== undefined && entityId !== null
        ? String(entityId)
        : null,
      changes ? JSON.stringify(changes) : null,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      status,
    ]
  );
}

// GET ALL AUDIT LOGS
async function getAllAuditLogs({
  page = 1,
  limit = 20,
  entity = null,
  action = null,
  userId = null,
}) {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(
    100,
    Math.max(1, Number(limit) || 20)
  );

  const offset = (parsedPage - 1) * parsedLimit;

  const conditions = [];
  const params = [];

  if (entity) {
    conditions.push("entity = ?");
    params.push(String(entity).trim().toUpperCase());
  }

  if (action) {
    conditions.push("action = ?");
    params.push(String(action).trim().toUpperCase());
  }

  if (userId !== null && userId !== undefined && userId !== "") {
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      throw new Error("Invalid userId");
    }

    conditions.push("user_id = ?");
    params.push(parsedUserId);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [rows] = await pool.query(
    `
    SELECT
      id,
      request_id,
      user_id,
      user_name,
      user_role,
      ip,
      action,
      entity,
      entity_id,
      changes,
      before_data,
      after_data,
      status,
      timestamp
    FROM audit_logs
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, parsedLimit, offset]
  );

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM audit_logs
    ${whereClause}
    `,
    params
  );

  return {
    data: rows,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: Number(countRows[0].total),
      totalPages: Math.ceil(
        Number(countRows[0].total) / parsedLimit
      ),
    },
  };
}

module.exports = {
  createAuditLog,
  getAllAuditLogs,
};