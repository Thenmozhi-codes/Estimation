const pool = require("../config/db");

// =====================================================
// GET ALL PRICE TIERS
// =====================================================
async function getAllPriceTiers() {
  const [rows] = await pool.query(`
    SELECT
      id,
      name,
      code
    FROM price_tiers
    ORDER BY id ASC
  `);

  return rows;
}


// =====================================================
// GET PRICE TIER BY ID
// =====================================================
async function getPriceTierById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      name,
      code
    FROM price_tiers
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}


// =====================================================
// CREATE PRICE TIER
// =====================================================
async function createPriceTier({
  name,
  code,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO price_tiers (
      name,
      code
    )
    VALUES (?, ?)
    `,
    [
      name,
      code,
    ]
  );

  return getPriceTierById(result.insertId);
}


// =====================================================
// UPDATE PRICE TIER
// =====================================================
async function updatePriceTier(
  id,
  {
    name,
    code,
  }
) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push("name = ?");
    values.push(String(name).trim());
  }

  if (code !== undefined) {
    fields.push("code = ?");
    values.push(String(code).trim());
  }

  if (fields.length === 0) {
    return getPriceTierById(id);
  }

  values.push(id);

  await pool.query(
    `
    UPDATE price_tiers
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getPriceTierById(id);
}


// =====================================================
// DELETE PRICE TIER
// =====================================================
async function deletePriceTier(id) {
  const [result] = await pool.query(
    `
    DELETE FROM price_tiers
    WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows > 0;
}


module.exports = {
  getAllPriceTiers,
  getPriceTierById,
  createPriceTier,
  updatePriceTier,
  deletePriceTier,
};