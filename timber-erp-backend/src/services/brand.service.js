const pool = require("../config/db");

async function getAllBrands() {
  const [rows] = await pool.query(`
    SELECT
      b.id,
      b.name,
      b.is_active,
      b.created_by_id,
      creator.name AS created_by_name,
      b.updated_by_id,
      updater.name AS updated_by_name,
      b.created_at,
      b.updated_at
    FROM brands b
    LEFT JOIN users creator ON creator.id = b.created_by_id
    LEFT JOIN users updater ON updater.id = b.updated_by_id
    ORDER BY b.id DESC
  `);

  return rows;
}

async function getBrandById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      b.id,
      b.name,
      b.is_active,
      b.created_by_id,
      creator.name AS created_by_name,
      b.updated_by_id,
      updater.name AS updated_by_name,
      b.created_at,
      b.updated_at
    FROM brands b
    LEFT JOIN users creator ON creator.id = b.created_by_id
    LEFT JOIN users updater ON updater.id = b.updated_by_id
    WHERE b.id = ?
    `,
    [id]
  );

  return rows[0] || null;
}

async function createBrand({ name, createdById }) {
  const [result] = await pool.query(
    `
    INSERT INTO brands (
      name,
      created_by_id
    )
    VALUES (?, ?)
    `,
    [name, createdById]
  );

  return getBrandById(result.insertId);
}

async function updateBrand(
  id,
  { name, isActive, updatedById }
) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push("name = ?");
    values.push(name);
  }

  if (isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(isActive);
  }

  fields.push("updated_by_id = ?");
  values.push(updatedById);

  values.push(id);

  await pool.query(
    `
    UPDATE brands
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getBrandById(id);
}

async function deleteBrand(id, updatedById) {
  const [result] = await pool.query(
    `
    UPDATE brands
    SET
      is_active = FALSE,
      updated_by_id = ?
    WHERE id = ?
    `,
    [updatedById, id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
};