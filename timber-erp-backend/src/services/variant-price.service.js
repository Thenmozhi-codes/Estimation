const pool = require("../config/db");

// =====================================================
// GET ALL PRICES FOR A VARIANT
// =====================================================
async function getVariantPrices(variantId) {
  const [rows] = await pool.query(
    `
    SELECT
      vp.id,
      vp.variant_id,
      pv.sku,

      vp.price_tier_id,
      pt.name AS price_tier_name,
      pt.code AS price_tier_code,

      vp.price,
      vp.updated_at

    FROM variant_prices vp

    INNER JOIN product_variants pv
      ON pv.id = vp.variant_id

    INNER JOIN price_tiers pt
      ON pt.id = vp.price_tier_id

    WHERE vp.variant_id = ?

    ORDER BY vp.price_tier_id ASC
    `,
    [variantId]
  );

  return rows;
}


// =====================================================
// GET PRICE BY ID
// =====================================================
async function getVariantPriceById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      vp.id,
      vp.variant_id,
      pv.sku,

      pv.product_id,

      vp.price_tier_id,
      pt.name AS price_tier_name,
      pt.code AS price_tier_code,

      vp.price,
      vp.updated_at

    FROM variant_prices vp

    INNER JOIN product_variants pv
      ON pv.id = vp.variant_id

    INNER JOIN price_tiers pt
      ON pt.id = vp.price_tier_id

    WHERE vp.id = ?

    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}


// =====================================================
// GET VARIANT
// =====================================================
async function getVariantById(variantId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      product_id,
      sku,
      reorder_level,
      is_active
    FROM product_variants
    WHERE id = ?
    LIMIT 1
    `,
    [variantId]
  );

  return rows[0] || null;
}


// =====================================================
// GET PRICE TIER
// =====================================================
async function getPriceTierById(priceTierId) {
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
    [priceTierId]
  );

  return rows[0] || null;
}


// =====================================================
// CHECK EXISTING PRICE
// =====================================================
async function getExistingVariantPrice(
  variantId,
  priceTierId
) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      variant_id,
      price_tier_id,
      price,
      updated_at
    FROM variant_prices
    WHERE variant_id = ?
      AND price_tier_id = ?
    LIMIT 1
    `,
    [
      variantId,
      priceTierId,
    ]
  );

  return rows[0] || null;
}


// =====================================================
// CREATE VARIANT PRICE
// =====================================================
async function createVariantPrice({
  variantId,
  priceTierId,
  price,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO variant_prices (
      variant_id,
      price_tier_id,
      price
    )
    VALUES (?, ?, ?)
    `,
    [
      variantId,
      priceTierId,
      price,
    ]
  );

  return getVariantPriceById(result.insertId);
}


// =====================================================
// UPDATE VARIANT PRICE
// =====================================================
async function updateVariantPrice(
  id,
  {
    priceTierId,
    price,
  }
) {
  const fields = [];
  const values = [];

  if (priceTierId !== undefined) {
    fields.push("price_tier_id = ?");
    values.push(priceTierId);
  }

  if (price !== undefined) {
    fields.push("price = ?");
    values.push(price);
  }

  if (fields.length === 0) {
    return getVariantPriceById(id);
  }

  values.push(id);

  await pool.query(
    `
    UPDATE variant_prices
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getVariantPriceById(id);
}


// =====================================================
// DELETE VARIANT PRICE
// =====================================================
async function deleteVariantPrice(id) {
  const [result] = await pool.query(
    `
    DELETE FROM variant_prices
    WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows > 0;
}


module.exports = {
  getVariantPrices,
  getVariantPriceById,
  getVariantById,
  getPriceTierById,
  getExistingVariantPrice,
  createVariantPrice,
  updateVariantPrice,
  deleteVariantPrice,
};