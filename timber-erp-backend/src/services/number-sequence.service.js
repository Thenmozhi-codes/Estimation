const pool = require("../config/db");

async function generateNumber(
  sequenceKey,
  prefix,
  padding = 4
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT
        sequence_key,
        prefix,
        next_number,
        padding
      FROM number_sequences
      WHERE sequence_key = ?
      FOR UPDATE
      `,
      [sequenceKey]
    );

    let nextNumber;
    let currentPrefix = prefix;
    let currentPadding = padding;

    if (rows.length === 0) {
      nextNumber = 1;

      await connection.query(
        `
        INSERT INTO number_sequences (
          sequence_key,
          prefix,
          next_number,
          padding
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          sequenceKey,
          currentPrefix,
          nextNumber + 1,
          currentPadding,
        ]
      );
    } else {
      const sequence = rows[0];

      nextNumber = Number(sequence.next_number);
      currentPrefix = sequence.prefix;
      currentPadding = Number(sequence.padding);

      await connection.query(
        `
        UPDATE number_sequences
        SET next_number = ?
        WHERE sequence_key = ?
        `,
        [
          nextNumber + 1,
          sequenceKey,
        ]
      );
    }

    await connection.commit();

    const formattedNumber = String(nextNumber).padStart(
      currentPadding,
      "0"
    );

    return `${currentPrefix}-${formattedNumber}`;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getSequences() {
  const [rows] = await pool.query(`
    SELECT
      sequence_key,
      prefix,
      next_number,
      padding
    FROM number_sequences
    ORDER BY sequence_key ASC
  `);

  return rows;
}

async function updateSequence(
  sequenceKey,
  prefix,
  padding
) {
  await pool.query(
    `
    INSERT INTO number_sequences (
      sequence_key,
      prefix,
      next_number,
      padding
    )
    VALUES (?, ?, 1, ?)
    ON DUPLICATE KEY UPDATE
      prefix = VALUES(prefix),
      padding = VALUES(padding)
    `,
    [
      sequenceKey,
      prefix,
      padding,
    ]
  );

  return getSequence(sequenceKey);
}

async function getSequence(sequenceKey) {
  const [rows] = await pool.query(
    `
    SELECT
      sequence_key,
      prefix,
      next_number,
      padding
    FROM number_sequences
    WHERE sequence_key = ?
    LIMIT 1
    `,
    [sequenceKey]
  );

  return rows[0] || null;
}

module.exports = {
  generateNumber,
  getSequences,
  getSequence,
  updateSequence,
};