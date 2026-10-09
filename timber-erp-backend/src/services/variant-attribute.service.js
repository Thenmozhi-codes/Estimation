const pool = require("../config/db");

// =====================================================
// GET VARIANT ATTRIBUTES
// =====================================================
async function getVariantAttributes(variantId) {
  const [rows] = await pool.query(
    `
    SELECT
      vav.variant_id,

      av.attribute_id,
      a.name AS attribute_name,
      a.code AS attribute_code,
      a.type AS attribute_type,

      vav.attribute_value_id,
      av.value AS attribute_value,
      av.sort_order

    FROM variant_attribute_values vav

    INNER JOIN attribute_values av
      ON av.id = vav.attribute_value_id

    INNER JOIN attributes a
      ON a.id = av.attribute_id

    WHERE vav.variant_id = ?

    ORDER BY a.id ASC, av.sort_order ASC
    `,
    [variantId]
  );

  return rows;
}


// =====================================================
// GET VARIANT
// =====================================================
async function getVariant(variantId) {
  const [rows] = await pool.query(
    `
    SELECT
      pv.id,
      pv.product_id,
      pv.sku,
      pv.reorder_level,
      pv.is_active,
      p.category_id

    FROM product_variants pv

    INNER JOIN products p
      ON p.id = pv.product_id

    WHERE pv.id = ?

    LIMIT 1
    `,
    [variantId]
  );

  return rows[0] || null;
}


// =====================================================
// CHECK CATEGORY ATTRIBUTE
// =====================================================
async function getCategoryAttribute(
  categoryId,
  attributeId
) {
  const [rows] = await pool.query(
    `
    SELECT
      ca.category_id,
      ca.attribute_id,
      ca.is_required,

      a.name AS attribute_name,
      a.code AS attribute_code,
      a.type AS attribute_type,
      a.is_active

    FROM category_attributes ca

    INNER JOIN attributes a
      ON a.id = ca.attribute_id

    WHERE ca.category_id = ?
      AND ca.attribute_id = ?

    LIMIT 1
    `,
    [
      categoryId,
      attributeId,
    ]
  );

  return rows[0] || null;
}


// =====================================================
// CHECK ATTRIBUTE VALUE
// =====================================================
async function getAttributeValue(
  attributeId,
  attributeValueId
) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      attribute_id,
      value,
      sort_order

    FROM attribute_values

    WHERE id = ?
      AND attribute_id = ?

    LIMIT 1
    `,
    [
      attributeValueId,
      attributeId,
    ]
  );

  return rows[0] || null;
}


// =====================================================
// REPLACE VARIANT ATTRIBUTES
// =====================================================
async function replaceVariantAttributes(
  variantId,
  attributes
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();


    // ---------------------------------------------
    // DELETE EXISTING MAPPINGS
    // ---------------------------------------------
    await connection.query(
      `
      DELETE FROM variant_attribute_values
      WHERE variant_id = ?
      `,
      [variantId]
    );


    // ---------------------------------------------
    // INSERT NEW MAPPINGS
    // ---------------------------------------------
    for (const item of attributes) {
      await connection.query(
        `
        INSERT INTO variant_attribute_values (
          variant_id,
          attribute_value_id
        )
        VALUES (?, ?)
        `,
        [
          variantId,
          item.attributeValueId,
        ]
      );
    }


    await connection.commit();

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }


  return getVariantAttributes(variantId);
}


module.exports = {
  getVariantAttributes,
  getVariant,
  getCategoryAttribute,
  getAttributeValue,
  replaceVariantAttributes,
};