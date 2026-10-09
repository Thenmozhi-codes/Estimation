const bcrypt = require("bcryptjs");
const pool = require("../config/db");
require("dotenv").config();

async function createAdmin() {
  try {
    const [roles] = await pool.query(
      `
      SELECT id, name
      FROM roles
      WHERE name = 'ADMIN'
      LIMIT 1
      `
    );

    if (roles.length === 0) {
      throw new Error("ADMIN role not found");
    }

    const roleId = roles[0].id;

    const email = "admin@timbererp.com";
    const password = "Admin@123";

    const passwordHash = await bcrypt.hash(password, 12);

    const [existingUsers] = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (existingUsers.length > 0) {
      console.log("⚠️ Admin user already exists");
      console.log(`Email: ${email}`);
      process.exit(0);
    }

    const [result] = await pool.query(
      `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role_id,
        is_active
      )
      VALUES (?, ?, ?, ?, TRUE)
      `,
      [
        "System Admin",
        email,
        passwordHash,
        roleId,
      ]
    );

    console.log("✅ Admin user created successfully");
    console.log("User ID:", result.insertId);
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("Role:", roles[0].name);

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create admin:", error.message);
    process.exit(1);
  }
}

createAdmin();