const pool = require("../config/db");

const POSITIVE_MOVEMENT_TYPES = [
  "OPENING",
  "PURCHASE",
  "RETURN_IN",
];

const NEGATIVE_MOVEMENT_TYPES = [
  "SALE",
  "RETURN_OUT",
];

const ALL_MOVEMENT_TYPES = [
  "OPENING",
  "PURCHASE",
  "SALE",
  "RETURN_IN",
  "RETURN_OUT",
  "ADJUSTMENT",
];

async function getVariant(variantId) {
  const [rows] = await pool.query(
    `
    SELECT
      pv.id,
      pv.product_id,
      pv.sku,
      pv.reorder_level,
      pv.is_active,
      p.name AS product_name,
      p.category_id,
      p.base_unit_id
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

async function getStockMovementById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      sm.id,
      sm.variant_id,
      pv.sku,
      p.name AS product_name,
      sm.type,
      sm.quantity,
      sm.ref_type,
      sm.ref_id,
      sm.note,
      sm.created_by_id,
      u.name AS created_by_name,
      sm.created_at
    FROM stock_movements sm
    INNER JOIN product_variants pv
      ON pv.id = sm.variant_id
    INNER JOIN products p
      ON p.id = pv.product_id
    LEFT JOIN users u
      ON u.id = sm.created_by_id
    WHERE sm.id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function getStockMovements({
  variantId = null,
  type = null,
  refType = null,
} = {}) {
  let query = `
    SELECT
      sm.id,
      sm.variant_id,
      pv.sku,
      p.name AS product_name,
      sm.type,
      sm.quantity,
      sm.ref_type,
      sm.ref_id,
      sm.note,
      sm.created_by_id,
      u.name AS created_by_name,
      sm.created_at
    FROM stock_movements sm
    INNER JOIN product_variants pv
      ON pv.id = sm.variant_id
    INNER JOIN products p
      ON p.id = pv.product_id
    LEFT JOIN users u
      ON u.id = sm.created_by_id
    WHERE 1 = 1
  `;

  const params = [];

  if (variantId !== null) {
    query += ` AND sm.variant_id = ?`;
    params.push(variantId);
  }

  if (type !== null) {
    query += ` AND sm.type = ?`;
    params.push(type);
  }

  if (refType !== null) {
    query += ` AND sm.ref_type = ?`;
    params.push(refType);
  }

  query += ` ORDER BY sm.id DESC`;

  const [rows] = await pool.query(query, params);

  return rows;
}

async function getVariantStockBalance(variantId) {
  const [rows] = await pool.query(
    `
    SELECT
      pv.id AS variant_id,
      pv.sku,
      p.name AS product_name,
      pv.reorder_level,

      COALESCE(
        SUM(
          CASE
            WHEN sm.type IN ('OPENING', 'PURCHASE', 'RETURN_IN')
              THEN sm.quantity

            WHEN sm.type IN ('SALE', 'RETURN_OUT')
              THEN -sm.quantity

            WHEN sm.type = 'ADJUSTMENT'
              THEN sm.quantity

            ELSE 0
          END
        ),
        0
      ) AS current_stock

    FROM product_variants pv

    INNER JOIN products p
      ON p.id = pv.product_id

    LEFT JOIN stock_movements sm
      ON sm.variant_id = pv.id

    WHERE pv.id = ?

    GROUP BY
      pv.id,
      pv.sku,
      p.name,
      pv.reorder_level
    `,
    [variantId]
  );

  return rows[0] || null;
}
async function createStockMovement({
  variantId,
  type,
  quantity,
  refType = null,
  refId = null,
  note = null,
  createdById = null,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO stock_movements (
      variant_id,
      type,
      quantity,
      ref_type,
      ref_id,
      note,
      created_by_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      variantId,
      type,
      quantity,
      refType,
      refId,
      note,
      createdById,
    ]
  );

  return getStockMovementById(result.insertId);
}

module.exports = {
  ALL_MOVEMENT_TYPES,
  POSITIVE_MOVEMENT_TYPES,
  NEGATIVE_MOVEMENT_TYPES,
  getVariant,
  getStockMovementById,
  getStockMovements,
  getVariantStockBalance,
  createStockMovement,
};