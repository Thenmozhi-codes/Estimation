const pool = require("../config/db");

const {
  generateNumber,
} = require("./number-sequence.service");

const VALID_DIRECTIONS = ["RECEIVED", "PAID"];

const VALID_METHODS = [
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CARD",
  "CHEQUE",
];

async function getPaymentById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.payment_no,
      p.party_id,
      pa.name AS party_name,
      p.direction,
      p.quotation_id,
      q.quotation_no,
      p.invoice_id,
      i.invoice_no,
      p.purchase_id,
      pu.purchase_no,
      p.amount,
      p.method,
      p.reference,
      p.paid_at,
      p.notes,
      p.created_by_id,
      u.name AS created_by_name,
      p.created_at
    FROM payments p
    INNER JOIN parties pa
      ON pa.id = p.party_id
    LEFT JOIN quotations q
      ON q.id = p.quotation_id
    LEFT JOIN invoices i
      ON i.id = p.invoice_id
    LEFT JOIN purchases pu
      ON pu.id = p.purchase_id
    LEFT JOIN users u
      ON u.id = p.created_by_id
    WHERE p.id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function getAllPayments({
  partyId = null,
  direction = null,
  invoiceId = null,
  purchaseId = null,
} = {}) {
  let query = `
    SELECT
      p.id,
      p.payment_no,
      p.party_id,
      pa.name AS party_name,
      p.direction,
      p.quotation_id,
      q.quotation_no,
      p.invoice_id,
      i.invoice_no,
      p.purchase_id,
      pu.purchase_no,
      p.amount,
      p.method,
      p.reference,
      p.paid_at,
      p.notes,
      p.created_by_id,
      u.name AS created_by_name,
      p.created_at
    FROM payments p
    INNER JOIN parties pa
      ON pa.id = p.party_id
    LEFT JOIN quotations q
      ON q.id = p.quotation_id
    LEFT JOIN invoices i
      ON i.id = p.invoice_id
    LEFT JOIN purchases pu
      ON pu.id = p.purchase_id
    LEFT JOIN users u
      ON u.id = p.created_by_id
    WHERE 1 = 1
  `;

  const params = [];

  if (partyId !== null) {
    query += ` AND p.party_id = ?`;
    params.push(partyId);
  }

  if (direction !== null) {
    query += ` AND p.direction = ?`;
    params.push(direction);
  }

  if (invoiceId !== null) {
    query += ` AND p.invoice_id = ?`;
    params.push(invoiceId);
  }

  if (purchaseId !== null) {
    query += ` AND p.purchase_id = ?`;
    params.push(purchaseId);
  }

  query += ` ORDER BY p.id DESC`;

  const [rows] = await pool.query(query, params);

  return rows;
}

async function getInvoice(invoiceId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      invoice_no,
      party_id,
      status,
      total
    FROM invoices
    WHERE id = ?
    LIMIT 1
    `,
    [invoiceId]
  );

  return rows[0] || null;
}

async function getPurchase(purchaseId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      purchase_no,
      supplier_id,
      status,
      total
    FROM purchases
    WHERE id = ?
    LIMIT 1
    `,
    [purchaseId]
  );

  return rows[0] || null;
}

async function getParty(partyId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      party_type,
      name,
      is_active
    FROM parties
    WHERE id = ?
    LIMIT 1
    `,
    [partyId]
  );

  return rows[0] || null;
}

async function getInvoicePaidAmount(invoiceId) {
  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(amount), 0) AS paid_amount
    FROM payments
    WHERE invoice_id = ?
      AND direction = 'RECEIVED'
    `,
    [invoiceId]
  );

  return Number(rows[0].paid_amount || 0);
}

async function getPurchasePaidAmount(purchaseId) {
  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(amount), 0) AS paid_amount
    FROM payments
    WHERE purchase_id = ?
      AND direction = 'PAID'
    `,
    [purchaseId]
  );

  return Number(rows[0].paid_amount || 0);
}

async function createPayment({
  paymentNo,
  partyId,
  direction,
  quotationId = null,
  invoiceId = null,
  purchaseId = null,
  amount,
  method,
  reference = null,
  paidAt = null,
  notes = null,
  createdById,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

const generatedPaymentNo = await generateNumber(
  "PAYMENT",
  "PAY",
  4
);

const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      throw new Error(
        "Payment amount must be greater than 0"
      );
    }

    if (!VALID_DIRECTIONS.includes(direction)) {
      throw new Error("Invalid payment direction");
    }

    if (!VALID_METHODS.includes(method)) {
      throw new Error("Invalid payment method");
    }

    const [partyRows] = await connection.query(
      `
      SELECT
        id,
        party_type,
        name,
        is_active
      FROM parties
      WHERE id = ?
      FOR UPDATE
      `,
      [partyId]
    );

    if (partyRows.length === 0) {
      throw new Error("Party not found");
    }

    const party = partyRows[0];

    if (!party.is_active) {
      throw new Error("Party is inactive");
    }

    /*
     * CUSTOMER RECEIVED PAYMENT
     */
    if (direction === "RECEIVED") {
      if (
        !["CUSTOMER", "BOTH"].includes(
          party.party_type
        )
      ) {
        throw new Error(
          "RECEIVED payment requires CUSTOMER or BOTH party"
        );
      }

      if (!invoiceId) {
        throw new Error(
          "invoiceId is required for RECEIVED payment"
        );
      }

      const [invoiceRows] =
        await connection.query(
          `
          SELECT
            id,
            invoice_no,
            party_id,
            status,
            total
          FROM invoices
          WHERE id = ?
          FOR UPDATE
          `,
          [invoiceId]
        );

      if (invoiceRows.length === 0) {
        throw new Error("Invoice not found");
      }

      const invoice = invoiceRows[0];

      if (invoice.party_id !== partyId) {
        throw new Error(
          "Payment party does not match invoice party"
        );
      }

      if (
        ![
          "CONFIRMED",
          "PARTIALLY_PAID",
          "PAID",
        ].includes(invoice.status)
      ) {
        throw new Error(
          "Payment can only be recorded for a confirmed invoice"
        );
      }

      const [paidRows] =
        await connection.query(
          `
          SELECT
            COALESCE(SUM(amount), 0) AS paid_amount
          FROM payments
          WHERE invoice_id = ?
            AND direction = 'RECEIVED'
          `,
          [invoiceId]
        );

      const paidAmount = Number(
        paidRows[0].paid_amount || 0
      );

      const outstanding =
        Number(invoice.total) - paidAmount;

      if (numericAmount > outstanding) {
        throw new Error(
          `Payment exceeds invoice outstanding amount. Outstanding: ${outstanding}`
        );
      }
    }

    /*
     * SUPPLIER PAID PAYMENT
     */
    if (direction === "PAID") {
      if (
        !["SUPPLIER", "BOTH"].includes(
          party.party_type
        )
      ) {
        throw new Error(
          "PAID payment requires SUPPLIER or BOTH party"
        );
      }

      if (!purchaseId) {
        throw new Error(
          "purchaseId is required for PAID payment"
        );
      }

      const [purchaseRows] =
        await connection.query(
          `
          SELECT
            id,
            purchase_no,
            supplier_id,
            status,
            total
          FROM purchases
          WHERE id = ?
          FOR UPDATE
          `,
          [purchaseId]
        );

      if (purchaseRows.length === 0) {
        throw new Error(
          "Purchase not found"
        );
      }

      const purchase =
        purchaseRows[0];

      if (
        purchase.supplier_id !== partyId
      ) {
        throw new Error(
          "Payment party does not match purchase supplier"
        );
      }

      if (
        ![
          "RECEIVED",
          "PARTIALLY_PAID",
          "PAID",
        ].includes(purchase.status)
      ) {
        throw new Error(
          "Payment can only be recorded for a received purchase"
        );
      }

      const [paidRows] =
        await connection.query(
          `
          SELECT
            COALESCE(SUM(amount), 0) AS paid_amount
          FROM payments
          WHERE purchase_id = ?
            AND direction = 'PAID'
          `,
          [purchaseId]
        );

      const paidAmount = Number(
        paidRows[0].paid_amount || 0
      );

      const outstanding =
        Number(purchase.total) - paidAmount;

      if (numericAmount > outstanding) {
        throw new Error(
          `Payment exceeds purchase outstanding amount. Outstanding: ${outstanding}`
        );
      }
    }

    const [result] =
      await connection.query(
        `
        INSERT INTO payments (
          payment_no,
          party_id,
          direction,
          quotation_id,
          invoice_id,
          purchase_id,
          amount,
          method,
          reference,
          paid_at,
          notes,
          created_by_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        
          [
  generatedPaymentNo,
  partyId,
  direction,
          quotationId,
          invoiceId,
          purchaseId,
          numericAmount,
          method,
          reference,
          paidAt || new Date(),
          notes,
          createdById,
        ]
      );

    const paymentId = result.insertId;

    /*
     * Update invoice status.
     */
    if (
      direction === "RECEIVED" &&
      invoiceId
    ) {
      const [invoiceRows] =
        await connection.query(
          `
          SELECT total
          FROM invoices
          WHERE id = ?
          `,
          [invoiceId]
        );

      const invoiceTotal =
        Number(invoiceRows[0].total);

      const [paidRows] =
        await connection.query(
          `
          SELECT
            COALESCE(SUM(amount), 0) AS paid_amount
          FROM payments
          WHERE invoice_id = ?
            AND direction = 'RECEIVED'
          `,
          [invoiceId]
        );

      const paidAmount =
        Number(
          paidRows[0].paid_amount || 0
        );

      let status = "PARTIALLY_PAID";

      if (paidAmount >= invoiceTotal) {
        status = "PAID";
      }

      await connection.query(
        `
        UPDATE invoices
        SET status = ?
        WHERE id = ?
        `,
        [status, invoiceId]
      );
    }

    /*
     * Update purchase status.
     */
    if (
      direction === "PAID" &&
      purchaseId
    ) {
      const [purchaseRows] =
        await connection.query(
          `
          SELECT total
          FROM purchases
          WHERE id = ?
          `,
          [purchaseId]
        );

      const purchaseTotal =
        Number(purchaseRows[0].total);

      const [paidRows] =
        await connection.query(
          `
          SELECT
            COALESCE(SUM(amount), 0) AS paid_amount
          FROM payments
          WHERE purchase_id = ?
            AND direction = 'PAID'
          `,
          [purchaseId]
        );

      const paidAmount =
        Number(
          paidRows[0].paid_amount || 0
        );

      let status = "PARTIALLY_PAID";

      if (paidAmount >= purchaseTotal) {
        status = "PAID";
      }

      await connection.query(
        `
        UPDATE purchases
        SET status = ?
        WHERE id = ?
        `,
        [status, purchaseId]
      );
    }

    await connection.commit();

    return getPaymentById(paymentId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getPartyOutstanding(partyId) {
  const [rows] = await pool.query(
    `
    SELECT
      pa.id AS party_id,
      pa.name,

      COALESCE(
        (
          SELECT SUM(i.total)
          FROM invoices i
          WHERE i.party_id = pa.id
            AND i.status IN (
              'CONFIRMED',
              'PARTIALLY_PAID',
              'PAID'
            )
        ),
        0
      ) AS invoice_total,

      COALESCE(
        (
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.party_id = pa.id
            AND p.direction = 'RECEIVED'
            AND p.invoice_id IS NOT NULL
        ),
        0
      ) AS received_amount,

      COALESCE(
        (
          SELECT SUM(pu.total)
          FROM purchases pu
          WHERE pu.supplier_id = pa.id
            AND pu.status IN (
              'RECEIVED',
              'PARTIALLY_PAID',
              'PAID'
            )
        ),
        0
      ) AS purchase_total,

      COALESCE(
        (
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.party_id = pa.id
            AND p.direction = 'PAID'
            AND p.purchase_id IS NOT NULL
        ),
        0
      ) AS paid_amount

    FROM parties pa
    WHERE pa.id = ?
    LIMIT 1
    `,
    [partyId]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    partyId: row.party_id,
    name: row.name,

    salesOutstanding: Math.max(
      Number(row.invoice_total) -
        Number(row.received_amount),
      0
    ),

    purchaseOutstanding: Math.max(
      Number(row.purchase_total) -
        Number(row.paid_amount),
      0
    ),
  };
}

module.exports = {
  VALID_DIRECTIONS,
  VALID_METHODS,
  getPaymentById,
  getAllPayments,
  getInvoice,
  getPurchase,
  getParty,
  getInvoicePaidAmount,
  getPurchasePaidAmount,
  createPayment,
  getPartyOutstanding,
};