const pool = require("../config/db");

async function getAllAttributeValues(attributeId) {
  const [rows] = await pool.query(
    `
    SELECT
      av.id,
      av.attribute_id,
      a.name AS attribute_name,
      av.value,
      av.sort_order,
      av.created_by_id,
      creator.name AS created_by_name,
      av.updated_by_id,
      updater.name AS updated_by_name,
      av.created_at,
      av.updated_at
    FROM attribute_values av
    INNER JOIN attributes a
      ON a.id = av.attribute_id
    LEFT JOIN users creator
      ON creator.id = av.created_by_id
    LEFT JOIN users updater
      ON updater.id = av.updated_by_id
    WHERE av.attribute_id = ?
    ORDER BY av.sort_order ASC, av.id ASC
    `,
    [attributeId]
  );

  return rows;
}

async function getAttributeValueById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      av.id,
      av.attribute_id,
      a.name AS attribute_name,
      av.value,
      av.sort_order,
      av.created_by_id,
      creator.name AS created_by_name,
      av.updated_by_id,
      updater.name AS updated_by_name,
      av.created_at,
      av.updated_at
    FROM attribute_values av
    INNER JOIN attributes a
      ON a.id = av.attribute_id
    LEFT JOIN users creator
      ON creator.id = av.created_by_id
    LEFT JOIN users updater
      ON updater.id = av.updated_by_id
    WHERE av.id = ?
    `,
    [id]
  );

  return rows[0] || null;
}

async function createAttributeValue({
  attributeId,
  value,
  sortOrder,
  createdById,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO attribute_values (
      attribute_id,
      value,
      sort_order,
      created_by_id
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      attributeId,
      value,
      sortOrder,
      createdById,
    ]
  );

  return getAttributeValueById(result.insertId);
}

async function updateAttributeValue(
  id,
  {
    value,
    sortOrder,
    updatedById,
  }
) {
  const fields = [];
  const values = [];

  if (value !== undefined) {
    fields.push("value = ?");
    values.push(value);
  }

  if (sortOrder !== undefined) {
    fields.push("sort_order = ?");
    values.push(sortOrder);
  }

  fields.push("updated_by_id = ?");
  values.push(updatedById);

  values.push(id);

  await pool.query(
    `
    UPDATE attribute_values
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getAttributeValueById(id);
}

async function deleteAttributeValue(id) {
  const [result] = await pool.query(
    `
    DELETE FROM attribute_values
    WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  getAllAttributeValues,
  getAttributeValueById,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
};