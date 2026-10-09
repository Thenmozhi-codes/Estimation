const pool = require("../config/db");

function parseSettingValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    // Legacy plain-text setting value
    return value;
  }
}

async function getAllSettings() {
  const [rows] = await pool.query(`
    SELECT
      setting_key,
      value,
      updated_at
    FROM settings
    ORDER BY setting_key ASC
  `);

  return rows.map((row) => ({
    setting_key: row.setting_key,
    value: parseSettingValue(row.value),
    updated_at: row.updated_at,
  }));
}

async function getSetting(key) {
  const [rows] = await pool.query(
    `
    SELECT
      setting_key,
      value,
      updated_at
    FROM settings
    WHERE setting_key = ?
    LIMIT 1
    `,
    [key]
  );

  if (!rows.length) {
    return null;
  }

  return {
    setting_key: rows[0].setting_key,
    value: parseSettingValue(rows[0].value),
    updated_at: rows[0].updated_at,
  };
}

async function upsertSetting(key, value) {
  await pool.query(
    `
    INSERT INTO settings (
      setting_key,
      value,
      updated_at
    )
    VALUES (?, ?, CURRENT_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE
      value = VALUES(value),
      updated_at = CURRENT_TIMESTAMP(3)
    `,
    [
      key,
      JSON.stringify(value),
    ]
  );

  return getSetting(key);
}

module.exports = {
  getAllSettings,
  getSetting,
  upsertSetting,
};