const pool = require("../config/db");

async function getAllUnits() {
  const [rows] = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.symbol,
      u.created_by_id,
      creator.name AS created_by_name,
      u.updated_by_id,
      updater.name AS updated_by_name,
      u.created_at,
      u.updated_at
    FROM units u
    LEFT JOIN users creator ON creator.id = u.created_by_id
    LEFT JOIN users updater ON updater.id = u.updated_by_id
    ORDER BY u.id DESC
  `);

  return rows;
}

async function getUnitById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.symbol,
      u.created_by_id,
      creator.name AS created_by_name,
      u.updated_by_id,
      updater.name AS updated_by_name,
      u.created_at,
      u.updated_at
    FROM units u
    LEFT JOIN users creator ON creator.id = u.created_by_id
    LEFT JOIN users updater ON updater.id = u.updated_by_id
    WHERE u.id = ?
    `,
    [id]
  );

  return rows[0] || null;
}

async function createUnit({
  name,
  symbol,
  createdById,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO units (
      name,
      symbol,
      created_by_id
    )
    VALUES (?, ?, ?)
    `,
    [name, symbol || null, createdById]
  );

  return getUnitById(result.insertId);
}

async function updateUnit(
  id,
  { name, symbol, updatedById }
) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push("name = ?");
    values.push(name);
  }

  if (symbol !== undefined) {
    fields.push("symbol = ?");
    values.push(symbol);
  }

  fields.push("updated_by_id = ?");
  values.push(updatedById);

  values.push(id);

  await pool.query(
    `
    UPDATE units
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getUnitById(id);
}

async function deleteUnit(id) {
  const [usageRows] = await pool.query(
    `
    SELECT COUNT(*) AS count
    FROM products
    WHERE base_unit_id = ?
    `,
    [id]
  );

  if (Number(usageRows[0].count) > 0) {
    return {
      deleted: false,
      reason: "UNIT_IN_USE",
      usageCount: Number(usageRows[0].count),
    };
  }

  const [result] = await pool.query(
    `
    DELETE FROM units
    WHERE id = ?
    `,
    [id]
  );

  return {
    deleted: result.affectedRows > 0,
    reason:
      result.affectedRows > 0
        ? null
        : "NOT_FOUND",
    usageCount: 0,
  };
}

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
};