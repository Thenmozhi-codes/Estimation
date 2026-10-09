const pool = require("../config/db");

const {
  generateNumber,
} = require("./number-sequence.service");

const VALID_STATUSES = [
  "DRAFT",
  "RECEIVED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
];

async function getSupplier(supplierId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      party_type,
      name,
      phone,
      email,
      gstin,
      is_active
    FROM parties
    WHERE id = ?
      AND party_type IN ('SUPPLIER', 'BOTH')
    LIMIT 1
    `,
    [supplierId]
  );

  return rows[0] || null;
}

async function getVariant(variantId) {
  const [rows] = await pool.query(
    `
    SELECT
      pv.id,
      pv.product_id,
      pv.sku,
      pv.is_active,
      p.name AS product_name,
      p.base_unit_id,
      u.name AS unit_name,
      u.symbol AS unit_symbol
    FROM product_variants pv
    INNER JOIN products p
      ON p.id = pv.product_id
    INNER JOIN units u
      ON u.id = p.base_unit_id
    WHERE pv.id = ?
    LIMIT 1
    `,
    [variantId]
  );

  return rows[0] || null;
}

async function getPurchaseById(id) {
  const [purchaseRows] = await pool.query(
    `
    SELECT
      p.id,
      p.purchase_no,
      p.supplier_id,
      s.name AS supplier_name,
      p.supplier_bill_no,
      p.purchase_date,
      p.status,
      p.subtotal,
      p.tax_amount,
      p.total,
      p.notes,
      p.created_by_id,
      u.name AS created_by_name,
      p.created_at,
      p.updated_at
    FROM purchases p
    INNER JOIN parties s
      ON s.id = p.supplier_id
    LEFT JOIN users u
      ON u.id = p.created_by_id
    WHERE p.id = ?
    LIMIT 1
    `,
    [id]
  );

  if (purchaseRows.length === 0) {
    return null;
  }

  const purchase = purchaseRows[0];

  const [items] = await pool.query(
    `
    SELECT
      pi.id,
      pi.purchase_id,
      pi.variant_id,
      pv.sku AS current_sku,
      pi.name,
      pi.sku,
      pi.unit_id,
      un.name AS unit_name,
      un.symbol AS unit_symbol,
      pi.unit_price,
      pi.quantity,
      pi.tax_rate,
      pi.line_total
    FROM purchase_items pi
    INNER JOIN product_variants pv
      ON pv.id = pi.variant_id
    INNER JOIN units un
      ON un.id = pi.unit_id
    WHERE pi.purchase_id = ?
    ORDER BY pi.id ASC
    `,
    [id]
  );

  purchase.items = items;

  return purchase;
}

async function getAllPurchases({
  supplierId = null,
  status = null,
} = {}) {
  let query = `
    SELECT
      p.id,
      p.purchase_no,
      p.supplier_id,
      s.name AS supplier_name,
      p.supplier_bill_no,
      p.purchase_date,
      p.status,
      p.subtotal,
      p.tax_amount,
      p.total,
      p.notes,
      p.created_by_id,
      u.name AS created_by_name,
      p.created_at,
      p.updated_at
    FROM purchases p
    INNER JOIN parties s
      ON s.id = p.supplier_id
    LEFT JOIN users u
      ON u.id = p.created_by_id
    WHERE 1 = 1
  `;

  const params = [];

  if (supplierId !== null) {
    query += ` AND p.supplier_id = ?`;
    params.push(supplierId);
  }

  if (status !== null) {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY p.id DESC`;

  const [rows] = await pool.query(query, params);

  return rows;
}

async function createPurchase({
  purchaseNo,
  supplierId,
  supplierBillNo = null,
  purchaseDate = null,
  notes = null,
  items,
  createdById,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

const generatedPurchaseNo = await generateNumber(
  "PURCHASE",
  "PUR",
  4
);

let subtotal = 0;
let taxAmount = 0;

    const preparedItems = [];

    for (const item of items) {
      const [variantRows] = await connection.query(
        `
        SELECT
          pv.id,
          pv.sku,
          pv.is_active,
          p.name AS product_name,
          p.base_unit_id
        FROM product_variants pv
        INNER JOIN products p
          ON p.id = pv.product_id
        WHERE pv.id = ?
        LIMIT 1
        `,
        [item.variantId]
      );

      if (variantRows.length === 0) {
        throw new Error(
          `Product variant ${item.variantId} not found`
        );
      }

      const variant = variantRows[0];

      if (!variant.is_active) {
        throw new Error(
          `Product variant ${item.variantId} is inactive`
        );
      }

      const [unitRows] = await connection.query(
        `
        SELECT id, name, symbol
        FROM units
        WHERE id = ?
        LIMIT 1
        `,
        [item.unitId]
      );

      if (unitRows.length === 0) {
        throw new Error(
          `Unit ${item.unitId} not found`
        );
      }

      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate || 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(
          `Invalid quantity for variant ${item.variantId}`
        );
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(
          `Invalid unit price for variant ${item.variantId}`
        );
      }

      if (
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100
      ) {
        throw new Error(
          `Invalid tax rate for variant ${item.variantId}`
        );
      }

      const baseAmount = quantity * unitPrice;
      const itemTax = baseAmount * (taxRate / 100);
      const lineTotal = baseAmount + itemTax;

      subtotal += baseAmount;
      taxAmount += itemTax;

      preparedItems.push({
        variantId: variant.id,
        name: variant.product_name,
        sku: variant.sku,
        unitId: item.unitId,
        unitPrice,
        quantity,
        taxRate,
        lineTotal,
      });
    }

    const total = subtotal + taxAmount;

    const [purchaseResult] = await connection.query(
      `
      INSERT INTO purchases (
        purchase_no,
        supplier_id,
        supplier_bill_no,
        purchase_date,
        status,
        subtotal,
        tax_amount,
        total,
        notes,
        created_by_id
      )
      VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)
      `,
      [
  generatedPurchaseNo,
  supplierId,
        supplierBillNo,
        purchaseDate || new Date(),
        subtotal,
        taxAmount,
        total,
        notes,
        createdById,
      ]
    );

    const purchaseId = purchaseResult.insertId;

    for (const item of preparedItems) {
      await connection.query(
        `
        INSERT INTO purchase_items (
          purchase_id,
          variant_id,
          name,
          sku,
          unit_id,
          unit_price,
          quantity,
          tax_rate,
          line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          purchaseId,
          item.variantId,
          item.name,
          item.sku,
          item.unitId,
          item.unitPrice,
          item.quantity,
          item.taxRate,
          item.lineTotal,
        ]
      );
    }

    await connection.commit();

    return getPurchaseById(purchaseId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePurchase(
  id,
  {
    supplierId,
    supplierBillNo,
    purchaseDate,
    notes,
    items,
  }
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [purchaseRows] = await connection.query(
      `
      SELECT *
      FROM purchases
      WHERE id = ?
      FOR UPDATE
      `,
      [id]
    );

    if (purchaseRows.length === 0) {
      throw new Error("Purchase not found");
    }

    const purchase = purchaseRows[0];

    if (purchase.status !== "DRAFT") {
      throw new Error(
        "Only DRAFT purchases can be edited"
      );
    }

    let subtotal = 0;
    let taxAmount = 0;
    const preparedItems = [];

    for (const item of items) {
      const [variantRows] = await connection.query(
        `
        SELECT
          pv.id,
          pv.sku,
          pv.is_active,
          p.name AS product_name
        FROM product_variants pv
        INNER JOIN products p
          ON p.id = pv.product_id
        WHERE pv.id = ?
        LIMIT 1
        `,
        [item.variantId]
      );

      if (variantRows.length === 0) {
        throw new Error(
          `Product variant ${item.variantId} not found`
        );
      }

      const variant = variantRows[0];

      if (!variant.is_active) {
        throw new Error(
          `Product variant ${item.variantId} is inactive`
        );
      }

      const [unitRows] = await connection.query(
        `
        SELECT id
        FROM units
        WHERE id = ?
        LIMIT 1
        `,
        [item.unitId]
      );

      if (unitRows.length === 0) {
        throw new Error(
          `Unit ${item.unitId} not found`
        );
      }

      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate || 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(
          `Invalid quantity for variant ${item.variantId}`
        );
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(
          `Invalid unit price for variant ${item.variantId}`
        );
      }

      if (
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100
      ) {
        throw new Error(
          `Invalid tax rate for variant ${item.variantId}`
        );
      }

      const baseAmount = quantity * unitPrice;
      const itemTax = baseAmount * (taxRate / 100);
      const lineTotal = baseAmount + itemTax;

      subtotal += baseAmount;
      taxAmount += itemTax;

      preparedItems.push({
        variantId: variant.id,
        name: variant.product_name,
        sku: variant.sku,
        unitId: item.unitId,
        unitPrice,
        quantity,
        taxRate,
        lineTotal,
      });
    }

    const total = subtotal + taxAmount;

    await connection.query(
      `
      UPDATE purchases
      SET
        supplier_id = ?,
        supplier_bill_no = ?,
        purchase_date = ?,
        subtotal = ?,
        tax_amount = ?,
        total = ?,
        notes = ?
      WHERE id = ?
      `,
      [
        supplierId,
        supplierBillNo,
        purchaseDate || purchase.purchase_date,
        subtotal,
        taxAmount,
        total,
        notes,
        id,
      ]
    );

    await connection.query(
      `
      DELETE FROM purchase_items
      WHERE purchase_id = ?
      `,
      [id]
    );

    for (const item of preparedItems) {
      await connection.query(
        `
        INSERT INTO purchase_items (
          purchase_id,
          variant_id,
          name,
          sku,
          unit_id,
          unit_price,
          quantity,
          tax_rate,
          line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          item.variantId,
          item.name,
          item.sku,
          item.unitId,
          item.unitPrice,
          item.quantity,
          item.taxRate,
          item.lineTotal,
        ]
      );
    }

    await connection.commit();

    return getPurchaseById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function receivePurchase(id, createdById) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [purchaseRows] = await connection.query(
      `
      SELECT *
      FROM purchases
      WHERE id = ?
      FOR UPDATE
      `,
      [id]
    );

    if (purchaseRows.length === 0) {
      throw new Error("Purchase not found");
    }

    const purchase = purchaseRows[0];

    if (purchase.status !== "DRAFT") {
      throw new Error(
        `Purchase cannot be received from ${purchase.status} status`
      );
    }

    const [items] = await connection.query(
      `
      SELECT
        id,
        variant_id,
        quantity
      FROM purchase_items
      WHERE purchase_id = ?
      ORDER BY id ASC
      `,
      [id]
    );

    if (items.length === 0) {
      throw new Error(
        "Cannot receive purchase without items"
      );
    }

    for (const item of items) {
      await connection.query(
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
        VALUES (
          ?,
          'PURCHASE',
          ?,
          'PURCHASE',
          ?,
          ?,
          ?
        )
        `,
        [
          item.variant_id,
          item.quantity,
          id,
          `Stock received from purchase ${purchase.purchase_no}`,
          createdById,
        ]
      );
    }

    await connection.query(
      `
      UPDATE purchases
      SET status = 'RECEIVED'
      WHERE id = ?
      `,
      [id]
    );

    await connection.commit();

    return getPurchaseById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelPurchase(id) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM purchases
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  if (rows.length === 0) {
    throw new Error("Purchase not found");
  }

  const purchase = rows[0];

  if (purchase.status !== "DRAFT") {
    throw new Error(
      "Only DRAFT purchases can be cancelled"
    );
  }

  await pool.query(
    `
    UPDATE purchases
    SET status = 'CANCELLED'
    WHERE id = ?
    `,
    [id]
  );

  return getPurchaseById(id);
}

module.exports = {
  VALID_STATUSES,
  getSupplier,
  getVariant,
  getPurchaseById,
  getAllPurchases,
  createPurchase,
  updatePurchase,
  receivePurchase,
  cancelPurchase,
};