const pool = require("../config/db");

async function getCategoryAttributes(categoryId) {
  const [rows] = await pool.query(
    `
    SELECT
      ca.category_id,
      c.name AS category_name,
      ca.attribute_id,
      a.name AS attribute_name,
      a.code AS attribute_code,
      a.type AS attribute_type,
      ca.is_required,
      ca.sort_order
    FROM category_attributes ca
    INNER JOIN categories c
      ON c.id = ca.category_id
    INNER JOIN attributes a
      ON a.id = ca.attribute_id
    WHERE ca.category_id = ?
    ORDER BY ca.sort_order ASC, ca.attribute_id ASC
    `,
    [categoryId]
  );

  return rows;
}

async function assignAttributeToCategory({
  categoryId,
  attributeId,
  isRequired,
  sortOrder,
}) {
  await pool.query(
    `
    INSERT INTO category_attributes (
      category_id,
      attribute_id,
      is_required,
      sort_order
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      categoryId,
      attributeId,
      isRequired,
      sortOrder,
    ]
  );

  const [rows] = await pool.query(
    `
    SELECT
      ca.category_id,
      ca.attribute_id,
      ca.is_required,
      ca.sort_order
    FROM category_attributes ca
    WHERE ca.category_id = ?
      AND ca.attribute_id = ?
    `,
    [categoryId, attributeId]
  );

  return rows[0];
}

async function updateCategoryAttribute({
  categoryId,
  attributeId,
  isRequired,
  sortOrder,
}) {
  await pool.query(
    `
    UPDATE category_attributes
    SET
      is_required = ?,
      sort_order = ?
    WHERE category_id = ?
      AND attribute_id = ?
    `,
    [
      isRequired,
      sortOrder,
      categoryId,
      attributeId,
    ]
  );

  const [rows] = await pool.query(
    `
    SELECT
      ca.category_id,
      ca.attribute_id,
      ca.is_required,
      ca.sort_order
    FROM category_attributes ca
    WHERE ca.category_id = ?
      AND ca.attribute_id = ?
    `,
    [categoryId, attributeId]
  );

  return rows[0] || null;
}

async function removeAttributeFromCategory(
  categoryId,
  attributeId
) {
  const [result] = await pool.query(
    `
    DELETE FROM category_attributes
    WHERE category_id = ?
      AND attribute_id = ?
    `,
    [categoryId, attributeId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  getCategoryAttributes,
  assignAttributeToCategory,
  updateCategoryAttribute,
  removeAttributeFromCategory,
};