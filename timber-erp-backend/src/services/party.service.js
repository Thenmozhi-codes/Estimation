const pool = require("../config/db");

async function getAllParties({ partyType = null, search = null } = {}) {
  let query = `
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
      credit_limit,
      is_active,
      created_at,
      updated_at
    FROM parties
    WHERE 1 = 1
  `;

  const params = [];

  if (partyType) {
    query += ` AND party_type = ?`;
    params.push(partyType);
  }

  if (search) {
    query += `
      AND (
        name LIKE ?
        OR phone LIKE ?
        OR email LIKE ?
        OR gstin LIKE ?
      )
    `;

    const searchValue = `%${search}%`;

    params.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue
    );
  }

  query += ` ORDER BY id DESC`;

  const [rows] = await pool.query(query, params);

  return rows;
}

async function getPartyById(id) {
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
      credit_limit,
      is_active,
      created_at,
      updated_at
    FROM parties
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function createParty(data) {
  const {
    partyType,
    name,
    phone = null,
    email = null,
    gstin = null,
    addressLine = null,
    city = null,
    state = null,
    pincode = null,
    creditLimit = null,
  } = data;

  const [result] = await pool.query(
    `
    INSERT INTO parties (
      party_type,
      name,
      phone,
      email,
      gstin,
      address_line,
      city,
      state,
      pincode,
      credit_limit,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `,
    [
      partyType,
      name,
      phone,
      email,
      gstin,
      addressLine,
      city,
      state,
      pincode,
      creditLimit,
    ]
  );

  return getPartyById(result.insertId);
}

async function updateParty(id, data) {
  const {
    partyType,
    name,
    phone = null,
    email = null,
    gstin = null,
    addressLine = null,
    city = null,
    state = null,
    pincode = null,
    creditLimit = null,
    isActive,
  } = data;

  const fields = [];
  const values = [];

  if (partyType !== undefined) {
    fields.push("party_type = ?");
    values.push(partyType);
  }

  if (name !== undefined) {
    fields.push("name = ?");
    values.push(name);
  }

  if (phone !== undefined) {
    fields.push("phone = ?");
    values.push(phone);
  }

  if (email !== undefined) {
    fields.push("email = ?");
    values.push(email);
  }

  if (gstin !== undefined) {
    fields.push("gstin = ?");
    values.push(gstin);
  }

  if (addressLine !== undefined) {
    fields.push("address_line = ?");
    values.push(addressLine);
  }

  if (city !== undefined) {
    fields.push("city = ?");
    values.push(city);
  }

  if (state !== undefined) {
    fields.push("state = ?");
    values.push(state);
  }

  if (pincode !== undefined) {
    fields.push("pincode = ?");
    values.push(pincode);
  }

  if (creditLimit !== undefined) {
    fields.push("credit_limit = ?");
    values.push(creditLimit);
  }

  if (isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(isActive);
  }

  if (fields.length === 0) {
    return getPartyById(id);
  }

  values.push(id);

  await pool.query(
    `
    UPDATE parties
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getPartyById(id);
}

async function deleteParty(id) {
  await pool.query(
    `
    UPDATE parties
    SET is_active = FALSE
    WHERE id = ?
    `,
    [id]
  );

  return getPartyById(id);
}

module.exports = {
  getAllParties,
  getPartyById,
  createParty,
  updateParty,
  deleteParty,
};