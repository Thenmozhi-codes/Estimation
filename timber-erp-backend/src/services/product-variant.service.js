const pool = require("../config/db");

async function getAllVariants(productId) {
  const [rows] = await pool.query(
    `
    SELECT
      pv.id,
      pv.product_id,
      p.name AS product_name,
      pv.sku,
      pv.reorder_level,
      pv.is_active,
      pv.created_by_id,
      creator.name AS created_by_name,
      pv.updated_by_id,
      updater.name AS updated_by_name,
      pv.created_at,
      pv.updated_at
    FROM product_variants pv
    INNER JOIN products p
      ON p.id = pv.product_id
    LEFT JOIN users creator
      ON creator.id = pv.created_by_id
    LEFT JOIN users updater
      ON updater.id = pv.updated_by_id
    WHERE pv.product_id = ?
    ORDER BY pv.id DESC
    `,
    [productId]
  );

  return rows;
}

async function getVariantById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      pv.id,
      pv.product_id,
      p.name AS product_name,
      pv.sku,
      pv.reorder_level,
      pv.is_active,
      pv.created_by_id,
      creator.name AS created_by_name,
      pv.updated_by_id,
      updater.name AS updated_by_name,
      pv.created_at,
      pv.updated_at
    FROM product_variants pv
    INNER JOIN products p
      ON p.id = pv.product_id
    LEFT JOIN users creator
      ON creator.id = pv.created_by_id
    LEFT JOIN users updater
      ON updater.id = pv.updated_by_id
    WHERE pv.id = ?
    `,
    [id]
  );

  return rows[0] || null;
}

async function createVariant({
  productId,
  sku,
  reorderLevel,
  createdById,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO product_variants (
      product_id,
      sku,
      reorder_level,
      created_by_id
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      productId,
      sku,
      reorderLevel,
      createdById,
    ]
  );

  return getVariantById(result.insertId);
}

async function updateVariant(
  id,
  {
    sku,
    reorderLevel,
    isActive,
    updatedById,
  }
) {
  const fields = [];
  const values = [];

  if (sku !== undefined) {
    fields.push("sku = ?");
    values.push(sku);
  }

  if (reorderLevel !== undefined) {
    fields.push("reorder_level = ?");
    values.push(reorderLevel);
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
    UPDATE product_variants
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getVariantById(id);
}

async function deleteVariant(id, updatedById) {
  const [result] = await pool.query(
    `
    UPDATE product_variants
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
  getAllVariants,
  getVariantById,
  createVariant,
  updateVariant,
  deleteVariant,
};