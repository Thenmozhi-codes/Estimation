const pool = require("../config/db");
const {
  generateNumber,
} = require("./number-sequence.service");

const VALID_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
  "EXPIRED",
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

async function getQuotationById(id) {
  const [quotationRows] = await pool.query(
    `
    SELECT
      q.id,
      q.quotation_no,
      q.party_id,
      p.name AS party_name,
      p.phone AS party_phone,
      p.email AS party_email,
      p.gstin AS party_gstin,
      p.address_line AS party_address,
      q.quotation_date,
      q.valid_until,
      q.status,
      q.subtotal,
      q.discount,
      q.tax_amount,
      q.total,
      q.notes,
      q.created_by_id,
      u.name AS created_by_name,
      q.created_at,
      q.updated_at
    FROM quotations q
    INNER JOIN parties p
      ON p.id = q.party_id
    LEFT JOIN users u
      ON u.id = q.created_by_id
    WHERE q.id = ?
    LIMIT 1
    `,
    [id]
  );

  if (quotationRows.length === 0) {
    return null;
  }

  const quotation = quotationRows[0];

  const [items] = await pool.query(
    `
    SELECT
      qi.id,
      qi.quotation_id,
      qi.variant_id,
      qi.name,
      qi.sku,
      qi.attributes,
      qi.unit_id,
      un.name AS unit_name,
      un.symbol AS unit_symbol,
      qi.unit_price,
      qi.thickness,
      qi.length_ft,
      qi.width_ft,
      qi.sqft,
      qi.quantity,
      qi.tax_rate,
      qi.line_total
    FROM quotation_items qi
    INNER JOIN units un
      ON un.id = qi.unit_id
    WHERE qi.quotation_id = ?
    ORDER BY qi.id ASC
    `,
    [id]
  );

  quotation.items = items;

  return quotation;
}

async function getAllQuotations({
  partyId = null,
  status = null,
} = {}) {
  let query = `
    SELECT
      q.id,
      q.quotation_no,
      q.party_id,
      p.name AS party_name,
      q.quotation_date,
      q.valid_until,
      q.status,
      q.subtotal,
      q.discount,
      q.tax_amount,
      q.total,
      q.notes,
      q.created_by_id,
      u.name AS created_by_name,
      q.created_at,
      q.updated_at
    FROM quotations q
    INNER JOIN parties p
      ON p.id = q.party_id
    LEFT JOIN users u
      ON u.id = q.created_by_id
    WHERE 1 = 1
  `;

  const params = [];

  if (partyId !== null) {
    query += ` AND q.party_id = ?`;
    params.push(partyId);
  }

  if (status !== null) {
    query += ` AND q.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY q.id DESC`;

  const [rows] = await pool.query(query, params);

  return rows;
}

async function calculateItems(items) {
  const preparedItems = [];

  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const variant = await getVariant(item.variantId);

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

    subtotal += baseAmount;

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
      baseAmount,
    });
  }

  return {
    preparedItems,
    subtotal,
  };
}

async function createQuotation({
  quotationNo,
  partyId,
  quotationDate = null,
  validUntil = null,
  discount = 0,
  notes = null,
  items,
  createdById,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const generatedQuotationNo = await generateNumber(
      "QUOTATION",
      "QT",
      4
    );

    const calculation = await calculateItems(items);

    const subtotal = calculation.subtotal;
    const numericDiscount = Number(discount || 0);

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

    const preparedItems =
      calculation.preparedItems;

    let taxAmount = 0;

    for (const item of preparedItems) {
      const itemDiscountRatio =
        subtotal > 0
          ? numericDiscount / subtotal
          : 0;

      const discountedBase =
        item.baseAmount *
        (1 - itemDiscountRatio);

      const itemTax =
        discountedBase *
        (item.taxRate / 100);

      item.lineTotal =
        discountedBase + itemTax;

      taxAmount += itemTax;
    }

    const total =
      taxableAmount + taxAmount;

    const [result] = await connection.query(
      `
      INSERT INTO quotations (
        quotation_no,
        party_id,
        quotation_date,
        valid_until,
        status,
        subtotal,
        discount,
        tax_amount,
        total,
        notes,
        created_by_id
      )
      VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)
      `,
      [
        generatedQuotationNo,
        partyId,
        quotationDate || new Date(),
        validUntil || null,
        subtotal,
        numericDiscount,
        taxAmount,
        total,
        notes,
        createdById,
      ]
    );

    const quotationId = result.insertId;

    for (const item of preparedItems) {
      await connection.query(
        `
        INSERT INTO quotation_items (
          quotation_id,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          quotationId,
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

    return getQuotationById(quotationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateQuotation(
  id,
  {
    partyId,
    quotationDate,
    validUntil,
    discount,
    notes,
    items,
  }
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT *
      FROM quotations
      WHERE id = ?
      FOR UPDATE
      `,
      [id]
    );

    if (rows.length === 0) {
      throw new Error("Quotation not found");
    }

    if (rows[0].status !== "DRAFT") {
      throw new Error(
        "Only DRAFT quotations can be edited"
      );
    }

    const calculation = await calculateItems(items);

    const subtotal = calculation.subtotal;
    const numericDiscount = Number(discount || 0);

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
        item.baseAmount * (1 - ratio);

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
      UPDATE quotations
      SET
        party_id = ?,
        quotation_date = ?,
        valid_until = ?,
        subtotal = ?,
        discount = ?,
        tax_amount = ?,
        total = ?,
        notes = ?
      WHERE id = ?
      `,
      [
        partyId,
        quotationDate || rows[0].quotation_date,
        validUntil || null,
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
      DELETE FROM quotation_items
      WHERE quotation_id = ?
      `,
      [id]
    );

    for (const item of calculation.preparedItems) {
      await connection.query(
        `
        INSERT INTO quotation_items (
          quotation_id,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    return getQuotationById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function changeStatus(id, newStatus) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM quotations
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  if (rows.length === 0) {
    throw new Error("Quotation not found");
  }

  const quotation = rows[0];

  const allowedTransitions = {
    DRAFT: ["PENDING"],
    PENDING: ["APPROVED", "REJECTED", "EXPIRED"],
    APPROVED: ["CONVERTED"],
    REJECTED: [],
    CONVERTED: [],
    EXPIRED: [],
  };

  if (
    !allowedTransitions[quotation.status].includes(
      newStatus
    )
  ) {
    throw new Error(
      `Cannot change quotation from ${quotation.status} to ${newStatus}`
    );
  }

  await pool.query(
    `
    UPDATE quotations
    SET status = ?
    WHERE id = ?
    `,
    [newStatus, id]
  );

  return getQuotationById(id);
}

module.exports = {
  VALID_STATUSES,
  getCustomer,
  getVariant,
  getUnit,
  getQuotationById,
  getAllQuotations,
  createQuotation,
  updateQuotation,
  changeStatus,
};