const pool = require("../config/db");

async function getAllAttributes() {
  const [rows] = await pool.query(`
    SELECT
      a.id,
      a.name,
      a.code,
      a.type,
      a.is_required,
      a.is_active,
      a.created_by_id,
      creator.name AS created_by_name,
      a.updated_by_id,
      updater.name AS updated_by_name,
      a.created_at,
      a.updated_at
    FROM attributes a
    LEFT JOIN users creator
      ON creator.id = a.created_by_id
    LEFT JOIN users updater
      ON updater.id = a.updated_by_id
    ORDER BY a.id DESC
  `);

  return rows;
}

async function getAttributeById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      a.id,
      a.name,
      a.code,
      a.type,
      a.is_required,
      a.is_active,
      a.created_by_id,
      creator.name AS created_by_name,
      a.updated_by_id,
      updater.name AS updated_by_name,
      a.created_at,
      a.updated_at
    FROM attributes a
    LEFT JOIN users creator
      ON creator.id = a.created_by_id
    LEFT JOIN users updater
      ON updater.id = a.updated_by_id
    WHERE a.id = ?
    `,
    [id]
  );

  return rows[0] || null;
}

async function createAttribute({
  name,
  code,
  type,
  isRequired,
  createdById,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO attributes (
      name,
      code,
      type,
      is_required,
      created_by_id
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      name,
      code,
      type,
      isRequired,
      createdById,
    ]
  );

  return getAttributeById(result.insertId);
}

async function updateAttribute(
  id,
  {
    name,
    code,
    type,
    isRequired,
    isActive,
    updatedById,
  }
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

  if (type !== undefined) {
    fields.push("type = ?");
    values.push(type);
  }

  if (isRequired !== undefined) {
    fields.push("is_required = ?");
    values.push(isRequired);
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
    UPDATE attributes
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getAttributeById(id);
}

async function deleteAttribute(id, updatedById) {
  const [result] = await pool.query(
    `
    UPDATE attributes
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
  getAllAttributes,
  getAttributeById,
  createAttribute,
  updateAttribute,
  deleteAttribute,
};