const pool = require("../config/db");

async function getDashboard() {
  const [
    [counts],
    [salesToday],
    [salesMonth],
    [purchasesToday],
    [purchasesMonth],
    [stockSummary],
    [lowStock],
    [outstanding],
    [recentInvoices],
    [recentPayments],
  ] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE is_active = 1) AS active_products,
        (SELECT COUNT(*) FROM product_variants WHERE is_active = 1) AS active_variants,
        (SELECT COUNT(*) FROM parties
          WHERE is_active = 1 AND party_type IN ('CUSTOMER', 'BOTH')
        ) AS active_customers,
        (SELECT COUNT(*) FROM parties
          WHERE is_active = 1 AND party_type IN ('SUPPLIER', 'BOTH')
        ) AS active_suppliers
    `),

    pool.query(`
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(SUM(total), 0) AS total_sales
      FROM invoices
      WHERE invoice_date >= CURDATE()
        AND invoice_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND status <> 'CANCELLED'
    `),

    pool.query(`
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(SUM(total), 0) AS total_sales
      FROM invoices
      WHERE invoice_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        AND invoice_date < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
        AND status <> 'CANCELLED'
    `),

    pool.query(`
      SELECT
        COUNT(*) AS purchase_count,
        COALESCE(SUM(total), 0) AS total_purchases
      FROM purchases
      WHERE purchase_date >= CURDATE()
        AND purchase_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND status <> 'CANCELLED'
    `),

    pool.query(`
      SELECT
        COUNT(*) AS purchase_count,
        COALESCE(SUM(total), 0) AS total_purchases
      FROM purchases
      WHERE purchase_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        AND purchase_date < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
        AND status <> 'CANCELLED'
    `),

    pool.query(`
      SELECT
        COUNT(*) AS variant_count,
        COALESCE(SUM(stock_qty), 0) AS total_stock
      FROM (
        SELECT
          pv.id,
          COALESCE(SUM(
            CASE
              WHEN sm.type IN ('OPENING', 'PURCHASE', 'RETURN_IN')
                THEN sm.quantity
              WHEN sm.type IN ('SALE', 'RETURN_OUT')
                THEN -sm.quantity
              WHEN sm.type = 'ADJUSTMENT'
                THEN sm.quantity
              ELSE 0
            END
          ), 0) AS stock_qty
        FROM product_variants pv
        LEFT JOIN stock_movements sm
          ON sm.variant_id = pv.id
        WHERE pv.is_active = 1
        GROUP BY pv.id
      ) stock_data
    `),

    pool.query(`
      SELECT
        pv.id AS variant_id,
        pv.sku,
        p.name AS product_name,
        pv.reorder_level,
        COALESCE(SUM(
          CASE
            WHEN sm.type IN ('OPENING', 'PURCHASE', 'RETURN_IN')
              THEN sm.quantity
            WHEN sm.type IN ('SALE', 'RETURN_OUT')
              THEN -sm.quantity
            WHEN sm.type = 'ADJUSTMENT'
              THEN sm.quantity
            ELSE 0
          END
        ), 0) AS current_stock
      FROM product_variants pv
      INNER JOIN products p
        ON p.id = pv.product_id
      LEFT JOIN stock_movements sm
        ON sm.variant_id = pv.id
      WHERE pv.is_active = 1
      GROUP BY
        pv.id,
        pv.sku,
        p.name,
        pv.reorder_level
      HAVING current_stock <= pv.reorder_level
      ORDER BY current_stock ASC
      LIMIT 20
    `),

    pool.query(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN i.status <> 'CANCELLED'
              THEN i.total
            ELSE 0
          END
        ), 0)
        -
        COALESCE(SUM(
          CASE
            WHEN p.direction = 'RECEIVED'
              THEN p.amount
            ELSE 0
          END
        ), 0) AS sales_outstanding,

        0 AS purchase_outstanding
      FROM invoices i
      LEFT JOIN payments p
        ON p.invoice_id = i.id
        AND p.direction = 'RECEIVED'
    `),

    pool.query(`
      SELECT
        i.id,
        i.invoice_no,
        i.party_name,
        i.total,
        i.status,
        i.invoice_date
      FROM invoices i
      ORDER BY i.id DESC
      LIMIT 10
    `),

    pool.query(`
      SELECT
        p.id,
        p.payment_no,
        p.party_id,
        pt.name AS party_name,
        p.direction,
        p.amount,
        p.method,
        p.paid_at
      FROM payments p
      INNER JOIN parties pt
        ON pt.id = p.party_id
      ORDER BY p.id DESC
      LIMIT 10
    `),
  ]);

  return {
    counts: counts[0],
    sales: {
      today: salesToday[0],
      month: salesMonth[0],
    },
    purchases: {
      today: purchasesToday[0],
      month: purchasesMonth[0],
    },
    stock: {
      summary: stockSummary[0],
      lowStock: lowStock,
    },
    outstanding: outstanding[0],
    recentInvoices,
    recentPayments,
  };
}

async function getSalesSummary({ from, to } = {}) {
  let where = `
    WHERE status <> 'CANCELLED'
  `;

  const params = [];

  if (from) {
    where += ` AND invoice_date >= ?`;
    params.push(`${from} 00:00:00`);
  }

  if (to) {
    where += ` AND invoice_date < DATE_ADD(?, INTERVAL 1 DAY)`;
    params.push(to);
  }

  const [summary] = await pool.query(
    `
    SELECT
      COUNT(*) AS invoice_count,
      COALESCE(SUM(subtotal), 0) AS subtotal,
      COALESCE(SUM(discount), 0) AS discount,
      COALESCE(SUM(tax_amount), 0) AS tax_amount,
      COALESCE(SUM(total), 0) AS total_sales
    FROM invoices
    ${where}
    `,
    params
  );

  const [daily] = await pool.query(
    `
    SELECT
      DATE(invoice_date) AS date,
      COUNT(*) AS invoice_count,
      COALESCE(SUM(total), 0) AS total_sales
    FROM invoices
    ${where}
    GROUP BY DATE(invoice_date)
    ORDER BY date ASC
    `,
    params
  );

  return {
    summary: summary[0],
    daily,
  };
}

async function getPurchaseSummary({ from, to } = {}) {
  let where = `
    WHERE status <> 'CANCELLED'
  `;

  const params = [];

  if (from) {
    where += ` AND purchase_date >= ?`;
    params.push(`${from} 00:00:00`);
  }

  if (to) {
    where += ` AND purchase_date < DATE_ADD(?, INTERVAL 1 DAY)`;
    params.push(to);
  }

  const [summary] = await pool.query(
    `
    SELECT
      COUNT(*) AS purchase_count,
      COALESCE(SUM(subtotal), 0) AS subtotal,
      COALESCE(SUM(tax_amount), 0) AS tax_amount,
      COALESCE(SUM(total), 0) AS total_purchases
    FROM purchases
    ${where}
    `,
    params
  );

  const [daily] = await pool.query(
    `
    SELECT
      DATE(purchase_date) AS date,
      COUNT(*) AS purchase_count,
      COALESCE(SUM(total), 0) AS total_purchases
    FROM purchases
    ${where}
    GROUP BY DATE(purchase_date)
    ORDER BY date ASC
    `,
    params
  );

  return {
    summary: summary[0],
    daily,
  };
}

async function getStockSummary() {
  const [rows] = await pool.query(`
    SELECT
      pv.id AS variant_id,
      pv.sku,
      p.name AS product_name,
      c.name AS category_name,
      pv.reorder_level,

      COALESCE(SUM(
        CASE
          WHEN sm.type IN ('OPENING', 'PURCHASE', 'RETURN_IN')
            THEN sm.quantity
          WHEN sm.type IN ('SALE', 'RETURN_OUT')
            THEN -sm.quantity
          WHEN sm.type = 'ADJUSTMENT'
            THEN sm.quantity
          ELSE 0
        END
      ), 0) AS current_stock

    FROM product_variants pv

    INNER JOIN products p
      ON p.id = pv.product_id

    INNER JOIN categories c
      ON c.id = p.category_id

    LEFT JOIN stock_movements sm
      ON sm.variant_id = pv.id

    WHERE pv.is_active = 1

    GROUP BY
      pv.id,
      pv.sku,
      p.name,
      c.name,
      pv.reorder_level

    ORDER BY p.name ASC, pv.sku ASC
  `);

  return rows;
}

async function getOutstandingSummary() {
  const [receivables] = await pool.query(`
    SELECT
      p.id AS party_id,
      p.name AS party_name,
      p.party_type,

      COALESCE(SUM(i.total), 0) AS invoice_total,

      COALESCE((
        SELECT SUM(pay.amount)
        FROM payments pay
        WHERE pay.party_id = p.id
          AND pay.direction = 'RECEIVED'
          AND pay.invoice_id IS NOT NULL
      ), 0) AS received_amount,

      COALESCE(SUM(i.total), 0)
      -
      COALESCE((
        SELECT SUM(pay.amount)
        FROM payments pay
        WHERE pay.party_id = p.id
          AND pay.direction = 'RECEIVED'
          AND pay.invoice_id IS NOT NULL
      ), 0) AS outstanding

    FROM parties p

    LEFT JOIN invoices i
      ON i.party_id = p.id
      AND i.status <> 'CANCELLED'

    WHERE p.party_type IN ('CUSTOMER', 'BOTH')

    GROUP BY
      p.id,
      p.name,
      p.party_type

    HAVING outstanding > 0

    ORDER BY outstanding DESC
  `);

  const [payables] = await pool.query(`
    SELECT
      p.id AS party_id,
      p.name AS party_name,
      p.party_type,

      COALESCE(SUM(pu.total), 0) AS purchase_total,

      COALESCE((
        SELECT SUM(pay.amount)
        FROM payments pay
        WHERE pay.party_id = p.id
          AND pay.direction = 'PAID'
          AND pay.purchase_id IS NOT NULL
      ), 0) AS paid_amount,

      COALESCE(SUM(pu.total), 0)
      -
      COALESCE((
        SELECT SUM(pay.amount)
        FROM payments pay
        WHERE pay.party_id = p.id
          AND pay.direction = 'PAID'
          AND pay.purchase_id IS NOT NULL
      ), 0) AS outstanding

    FROM parties p

    LEFT JOIN purchases pu
      ON pu.supplier_id = p.id
      AND pu.status <> 'CANCELLED'

    WHERE p.party_type IN ('SUPPLIER', 'BOTH')

    GROUP BY
      p.id,
      p.name,
      p.party_type

    HAVING outstanding > 0

    ORDER BY outstanding DESC
  `);

  return {
    receivables,
    payables,
  };
}

module.exports = {
  getDashboard,
  getSalesSummary,
  getPurchaseSummary,
  getStockSummary,
  getOutstandingSummary,
};