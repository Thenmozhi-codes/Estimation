const pool = require("../config/db");

async function getAllCategories() {
  const [rows] = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.code,
      c.is_active,
      c.created_by_id,
      creator.name AS created_by_name,
      c.updated_by_id,
      updater.name AS updated_by_name,
      c.created_at,
      c.updated_at
    FROM categories c
    LEFT JOIN users creator ON creator.id = c.created_by_id
    LEFT JOIN users updater ON updater.id = c.updated_by_id
    ORDER BY c.id DESC
  `);

  return rows;
}

async function getCategoryById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      c.id,
      c.name,
      c.code,
      c.is_active,
      c.created_by_id,
      creator.name AS created_by_name,
      c.updated_by_id,
      updater.name AS updated_by_name,
      c.created_at,
      c.updated_at
    FROM categories c
    LEFT JOIN users creator ON creator.id = c.created_by_id
    LEFT JOIN users updater ON updater.id = c.updated_by_id
    WHERE c.id = ?
    `,
    [id]
  );

  return rows[0] || null;
}

async function createCategory({ name, code, createdById }) {
  const [result] = await pool.query(
    `
    INSERT INTO categories (
      name,
      code,
      created_by_id
    )
    VALUES (?, ?, ?)
    `,
    [name, code, createdById]
  );

  return getCategoryById(result.insertId);
}

async function updateCategory(
  id,
  { name, code, isActive, updatedById }
) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push("name = ?");
    values.push(name);
  }

  if (code !== undefined) {
    fields.push("code = ?");
    values.push(code);
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
    UPDATE categories
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getCategoryById(id);
}

async function deleteCategory(id, updatedById) {
  const [result] = await pool.query(
    `
    UPDATE categories
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
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};