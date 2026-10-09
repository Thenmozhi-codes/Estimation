const pool = require("../config/db");

async function getAllUsers() {
  const [rows] = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role_id,
      r.name AS role_name,
      u.is_active,
      u.last_login_at,
      u.created_at,
      u.updated_at
    FROM users u
    INNER JOIN roles r
      ON r.id = u.role_id
    ORDER BY u.id DESC
  `);

  return rows;
}

async function getUserById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role_id,
      r.name AS role_name,
      u.is_active,
      u.last_login_at,
      u.created_at,
      u.updated_at
    FROM users u
    INNER JOIN roles r
      ON r.id = u.role_id
    WHERE u.id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function getRoleById(roleId) {
  const [rows] = await pool.query(
    `
    SELECT id, name
    FROM roles
    WHERE id = ?
    LIMIT 1
    `,
    [roleId]
  );

  return rows[0] || null;
}

async function createUser({
  name,
  email,
  passwordHash,
  roleId,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO users (
      name,
      email,
      password_hash,
      role_id,
      is_active
    )
    VALUES (?, ?, ?, ?, 1)
    `,
    [
      name,
      email,
      passwordHash,
      roleId,
    ]
  );

  return getUserById(result.insertId);
}

async function updateUser(
  id,
  {
    name,
    email,
    roleId,
  }
) {
  await pool.query(
    `
    UPDATE users
    SET
      name = ?,
      email = ?,
      role_id = ?,
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE id = ?
    `,
    [
      name,
      email,
      roleId,
      id,
    ]
  );

  return getUserById(id);
}

async function updateUserStatus(
  id,
  isActive
) {
  await pool.query(
    `
    UPDATE users
    SET
      is_active = ?,
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE id = ?
    `,
    [
      isActive ? 1 : 0,
      id,
    ]
  );

  return getUserById(id);
}

async function updatePassword(
  id,
  passwordHash
) {
  await pool.query(
    `
    UPDATE users
    SET
      password_hash = ?,
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE id = ?
    `,
    [
      passwordHash,
      id,
    ]
  );
}

module.exports = {
  getAllUsers,
  getUserById,
  getRoleById,
  createUser,
  updateUser,
  updateUserStatus,
  updatePassword,
};