const pool = require("../config/db");

const {
  generateNumber,
} = require("./number-sequence.service");

const VALID_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
];

async function getCustomer(partyId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      party_type,
      name,
      phone,
      email,
      gstin,
      address_line,
      city,
      state,
      pincode,
      is_active
    FROM parties
    WHERE id = ?
      AND party_type IN ('CUSTOMER', 'BOTH')
    LIMIT 1
    `,
    [partyId]
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

async function getUnit(unitId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      name,
      symbol
    FROM units
    WHERE id = ?
    LIMIT 1
    `,
    [unitId]
  );

  return rows[0] || null;
}

async function getQuotationForInvoice(quotationId) {
  const [quotationRows] = await pool.query(
    `
    SELECT
      q.id,
      q.quotation_no,
      q.party_id,
      q.status,
      q.subtotal,
      q.discount,
      q.tax_amount,
      q.total,
      p.name AS party_name,
      p.gstin AS party_gstin,
      p.address_line AS party_address
    FROM quotations q
    INNER JOIN parties p
      ON p.id = q.party_id
    WHERE q.id = ?
    LIMIT 1
    `,
    [quotationId]
  );

  if (quotationRows.length === 0) {
    return null;
  }

  const quotation = quotationRows[0];

  const [items] = await pool.query(
    `
    SELECT
      qi.id,
      qi.variant_id,
      qi.name,
      qi.sku,
      qi.attributes,
      qi.unit_id,
      qi.unit_price,
      qi.thickness,
      qi.length_ft,
      qi.width_ft,
      qi.sqft,
      qi.quantity,
      qi.tax_rate,
      qi.line_total
    FROM quotation_items qi
    WHERE qi.quotation_id = ?
    ORDER BY qi.id ASC
    `,
    [quotationId]
  );

  quotation.items = items;

  return quotation;
}

async function getInvoiceById(id) {
  const [invoiceRows] = await pool.query(
    `
    SELECT
      i.id,
      i.invoice_no,
      i.quotation_id,
      i.party_id,

      i.party_name,
      i.party_gstin,
      i.party_address,

      i.invoice_date,
      i.due_date,
      i.status,

      i.subtotal,
      i.discount,
      i.tax_amount,
      i.total,

      i.notes,

      i.created_by_id,
      u.name AS created_by_name,

      i.created_at,
      i.updated_at
    FROM invoices i
    LEFT JOIN users u
      ON u.id = i.created_by_id
    WHERE i.id = ?
    LIMIT 1
    `,
    [id]
  );

  if (invoiceRows.length === 0) {
    return null;
  }

  const invoice = invoiceRows[0];

  const [items] = await pool.query(
    `
    SELECT
      ii.id,
      ii.invoice_id,
      ii.variant_id,
      ii.name,
      ii.sku,
      ii.attributes,
      ii.unit_id,

      un.name AS unit_name,
      un.symbol AS unit_symbol,

      ii.unit_price,
      ii.thickness,
      ii.length_ft,
      ii.width_ft,
      ii.sqft,
      ii.quantity,
      ii.tax_rate,
      ii.line_total

    FROM invoice_items ii

    INNER JOIN units un
      ON un.id = ii.unit_id

    WHERE ii.invoice_id = ?

    ORDER BY ii.id ASC
    `,
    [id]
  );

  invoice.items = items;

  return invoice;
}

async function getAllInvoices({
  partyId = null,
  status = null,
} = {}) {
  let query = `
    SELECT
      i.id,
      i.invoice_no,
      i.quotation_id,
      i.party_id,
      i.party_name,
      i.party_gstin,
      i.invoice_date,
      i.due_date,
      i.status,
      i.subtotal,
      i.discount,
      i.tax_amount,
      i.total,
      i.notes,
      i.created_by_id,
      u.name AS created_by_name,
      i.created_at,
      i.updated_at
    FROM invoices i
    LEFT JOIN users u
      ON u.id = i.created_by_id
    WHERE 1 = 1
  `;

  const params = [];

  if (partyId !== null) {
    query += ` AND i.party_id = ?`;
    params.push(partyId);
  }

  if (status !== null) {
    query += ` AND i.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY i.id DESC`;

  const [rows] = await pool.query(
    query,
    params
  );

  return rows;
}

async function calculateItems(items) {
  const preparedItems = [];

  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const variant = await getVariant(
      item.variantId
    );

    if (!variant) {
      throw new Error(
        `Product variant ${item.variantId} not found`
      );
    }

    if (!variant.is_active) {
      throw new Error(
        `Product variant ${item.variantId} is inactive`
      );
    }

    const unit = await getUnit(item.unitId);

    if (!unit) {
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

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
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

    const baseAmount =
      quantity * unitPrice;

    const itemTax =
      baseAmount * (taxRate / 100);

    const lineTotal =
      baseAmount + itemTax;

    subtotal += baseAmount;
    taxAmount += itemTax;

    preparedItems.push({
      variantId: variant.id,
      name: variant.product_name,
      sku: variant.sku,

      attributes:
        item.attributes !== undefined
          ? item.attributes
          : null,

      unitId: unit.id,

      unitPrice,
      thickness:
        item.thickness !== undefined &&
        item.thickness !== null
          ? Number(item.thickness)
          : null,

      lengthFt:
        item.lengthFt !== undefined &&
        item.lengthFt !== null
          ? Number(item.lengthFt)
          : null,

      widthFt:
        item.widthFt !== undefined &&
        item.widthFt !== null
          ? Number(item.widthFt)
          : null,

      sqft:
        item.sqft !== undefined &&
        item.sqft !== null
          ? Number(item.sqft)
          : null,

      quantity,
      taxRate,
      lineTotal,
    });
  }

  return {
    preparedItems,
    subtotal,
    taxAmount,
  };
}

async function createInvoice({
  invoiceNo,
  quotationId = null,
  partyId,
  partyName,
  partyGstin = null,
  partyAddress = null,
  invoiceDate = null,
  dueDate = null,
  discount = 0,
  notes = null,
  items,
  createdById,
}) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const generatedInvoiceNo =
  await generateNumber(
    "invoice",
    "INV",
    4
  );

    const calculation =
      await calculateItems(items);

    const subtotal =
      calculation.subtotal;

    const numericDiscount =
      Number(discount || 0);

    if (
      !Number.isFinite(numericDiscount) ||
      numericDiscount < 0
    ) {
      throw new Error(
        "Discount must be a valid non-negative number"
      );
    }

    if (numericDiscount > subtotal) {
      throw new Error(
        "Discount cannot be greater than subtotal"
      );
    }

    const taxableAmount =
      subtotal - numericDiscount;

    let taxAmount = 0;

    for (const item of calculation.preparedItems) {
      const discountRatio =
        subtotal > 0
          ? numericDiscount / subtotal
          : 0;

      const discountedBase =
        item.quantity *
        item.unitPrice *
        (1 - discountRatio);

      const itemTax =
        discountedBase *
        (item.taxRate / 100);

      item.lineTotal =
        discountedBase + itemTax;

      taxAmount += itemTax;
    }

    const total =
      taxableAmount + taxAmount;

    const [result] =
      await connection.query(
        `
        INSERT INTO invoices (
          invoice_no,
          quotation_id,
          party_id,

          party_name,
          party_gstin,
          party_address,

          invoice_date,
          due_date,
          status,

          subtotal,
          discount,
          tax_amount,
          total,

          notes,
          created_by_id
        )
        VALUES (
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, 'DRAFT',
          ?, ?, ?, ?,
          ?, ?
        )
        `,
       [
  generatedInvoiceNo,
  quotationId,
  partyId,

          partyName,
          partyGstin,
          partyAddress,

          invoiceDate || new Date(),
          dueDate || null,

          subtotal,
          numericDiscount,
          taxAmount,
          total,

          notes,
          createdById,
        ]
      );

    const invoiceId =
      result.insertId;

    for (const item of calculation.preparedItems) {
      await connection.query(
        `
        INSERT INTO invoice_items (
          invoice_id,
          variant_id,
          name,
          sku,
          attributes,
          unit_id,
          unit_price,
          thickness,
          length_ft,
          width_ft,
          sqft,
          quantity,
          tax_rate,
          line_total
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        `,
        [
          invoiceId,
          item.variantId,
          item.name,
          item.sku,
          item.attributes
            ? JSON.stringify(item.attributes)
            : null,
          item.unitId,
          item.unitPrice,
          item.thickness,
          item.lengthFt,
          item.widthFt,
          item.sqft,
          item.quantity,
          item.taxRate,
          item.lineTotal,
        ]
      );
    }

    await connection.commit();

    return getInvoiceById(invoiceId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateInvoice(
  id,
  {
    partyId,
    partyName,
    partyGstin,
    partyAddress,
    invoiceDate,
    dueDate,
    discount,
    notes,
    items,
  }
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] =
      await connection.query(
        `
        SELECT *
        FROM invoices
        WHERE id = ?
        FOR UPDATE
        `,
        [id]
      );

    if (rows.length === 0) {
      throw new Error(
        "Invoice not found"
      );
    }

    if (rows[0].status !== "DRAFT") {
      throw new Error(
        "Only DRAFT invoices can be edited"
      );
    }

    const calculation =
      await calculateItems(items);

    const subtotal =
      calculation.subtotal;

    const numericDiscount =
      Number(discount || 0);

    if (
      !Number.isFinite(numericDiscount) ||
      numericDiscount < 0
    ) {
      throw new Error(
        "Discount must be a valid non-negative number"
      );
    }

    if (numericDiscount > subtotal) {
      throw new Error(
        "Discount cannot be greater than subtotal"
      );
    }

    const taxableAmount =
      subtotal - numericDiscount;

    let taxAmount = 0;

    for (const item of calculation.preparedItems) {
      const ratio =
        subtotal > 0
          ? numericDiscount / subtotal
          : 0;

      const discountedBase =
        item.quantity *
        item.unitPrice *
        (1 - ratio);

      const itemTax =
        discountedBase *
        (item.taxRate / 100);

      item.lineTotal =
        discountedBase + itemTax;

      taxAmount += itemTax;
    }

    const total =
      taxableAmount + taxAmount;

    await connection.query(
      `
      UPDATE invoices
      SET
        party_id = ?,
        party_name = ?,
        party_gstin = ?,
        party_address = ?,
        invoice_date = ?,
        due_date = ?,
        subtotal = ?,
        discount = ?,
        tax_amount = ?,
        total = ?,
        notes = ?
      WHERE id = ?
      `,
      [
        partyId,
        partyName,
        partyGstin,
        partyAddress,
        invoiceDate ||
          rows[0].invoice_date,
        dueDate || null,
        subtotal,
        numericDiscount,
        taxAmount,
        total,
        notes,
        id,
      ]
    );

    await connection.query(
      `
      DELETE FROM invoice_items
      WHERE invoice_id = ?
      `,
      [id]
    );

    for (const item of calculation.preparedItems) {
      await connection.query(
        `
        INSERT INTO invoice_items (
          invoice_id,
          variant_id,
          name,
          sku,
          attributes,
          unit_id,
          unit_price,
          thickness,
          length_ft,
          width_ft,
          sqft,
          quantity,
          tax_rate,
          line_total
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        `,
        [
          id,
          item.variantId,
          item.name,
          item.sku,
          item.attributes
            ? JSON.stringify(item.attributes)
            : null,
          item.unitId,
          item.unitPrice,
          item.thickness,
          item.lengthFt,
          item.widthFt,
          item.sqft,
          item.quantity,
          item.taxRate,
          item.lineTotal,
        ]
      );
    }

    await connection.commit();

    return getInvoiceById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function confirmInvoice(
  id,
  createdById
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [invoiceRows] =
      await connection.query(
        `
        SELECT *
        FROM invoices
        WHERE id = ?
        FOR UPDATE
        `,
        [id]
      );

    if (invoiceRows.length === 0) {
      throw new Error(
        "Invoice not found"
      );
    }

    const invoice =
      invoiceRows[0];

    if (invoice.status !== "DRAFT") {
      throw new Error(
        `Invoice cannot be confirmed from ${invoice.status} status`
      );
    }

    const [items] =
      await connection.query(
        `
        SELECT
          id,
          variant_id,
          quantity
        FROM invoice_items
        WHERE invoice_id = ?
        ORDER BY id ASC
        `,
        [id]
      );

    if (items.length === 0) {
      throw new Error(
        "Cannot confirm invoice without items"
      );
    }

    /*
     * Check stock before creating SALE movements.
     */
    for (const item of items) {
      const [stockRows] =
        await connection.query(
          `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN type IN (
                    'OPENING',
                    'PURCHASE',
                    'RETURN_IN'
                  )
                  THEN quantity

                  WHEN type IN (
                    'SALE',
                    'RETURN_OUT'
                  )
                  THEN -quantity

                  WHEN type = 'ADJUSTMENT'
                  THEN quantity

                  ELSE 0
                END
              ),
              0
            ) AS current_stock

          FROM stock_movements

          WHERE variant_id = ?
          `,
          [item.variant_id]
        );

      const currentStock =
        Number(
          stockRows[0].current_stock || 0
        );

      const required =
        Number(item.quantity);

      if (currentStock < required) {
        throw new Error(
          `Insufficient stock for variant ${item.variant_id}. Available: ${currentStock}, Required: ${required}`
        );
      }
    }

    /*
     * Create SALE stock movements.
     */
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
          'SALE',
          ?,
          'INVOICE',
          ?,
          ?,
          ?
        )
        `,
        [
          item.variant_id,
          item.quantity,
          id,
          `Stock issued for invoice ${invoice.invoice_no}`,
          createdById,
        ]
      );
    }

    await connection.query(
      `
      UPDATE invoices
      SET status = 'CONFIRMED'
      WHERE id = ?
      `,
      [id]
    );

    /*
     * If this invoice came from a quotation,
     * mark quotation as CONVERTED.
     */
    if (invoice.quotation_id) {
      await connection.query(
        `
        UPDATE quotations
        SET status = 'CONVERTED'
        WHERE id = ?
          AND status = 'APPROVED'
        `,
        [invoice.quotation_id]
      );
    }

    await connection.commit();

    return getInvoiceById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelInvoice(id) {
  const [rows] =
    await pool.query(
      `
      SELECT *
      FROM invoices
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

  if (rows.length === 0) {
    throw new Error(
      "Invoice not found"
    );
  }

  if (rows[0].status !== "DRAFT") {
    throw new Error(
      "Only DRAFT invoices can be cancelled"
    );
  }

  await pool.query(
    `
    UPDATE invoices
    SET status = 'CANCELLED'
    WHERE id = ?
    `,
    [id]
  );

  return getInvoiceById(id);
}

module.exports = {
  VALID_STATUSES,
  getCustomer,
  getVariant,
  getUnit,
  getQuotationForInvoice,
  getInvoiceById,
  getAllInvoices,
  createInvoice,
  updateInvoice,
  confirmInvoice,
  cancelInvoice,
};