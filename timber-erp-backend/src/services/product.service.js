const pool = require("../config/db");

// =====================================================
// GET ALL PRODUCTS
// =====================================================
async function getAllProducts() {
  const [rows] = await pool.query(`
    SELECT
      p.id,
      p.name,
      p.category_id,
      c.name AS category_name,

      p.brand_id,
      b.name AS brand_name,

      p.base_unit_id,
      u.name AS base_unit_name,
      u.symbol AS base_unit_symbol,

      p.description,
      p.is_active,

      p.created_by_id,
      creator.name AS created_by_name,

      p.updated_by_id,
      updater.name AS updated_by_name,

      p.created_at,
      p.updated_at

    FROM products p

    INNER JOIN categories c
      ON c.id = p.category_id

    LEFT JOIN brands b
      ON b.id = p.brand_id

    INNER JOIN units u
      ON u.id = p.base_unit_id

    LEFT JOIN users creator
      ON creator.id = p.created_by_id

    LEFT JOIN users updater
      ON updater.id = p.updated_by_id

    ORDER BY p.id DESC
  `);

  return rows;
}


// =====================================================
// GET PRODUCT BY ID
// =====================================================
async function getProductById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.category_id,
      c.name AS category_name,

      p.brand_id,
      b.name AS brand_name,

      p.base_unit_id,
      u.name AS base_unit_name,
      u.symbol AS base_unit_symbol,

      p.description,
      p.is_active,

      p.created_by_id,
      creator.name AS created_by_name,

      p.updated_by_id,
      updater.name AS updated_by_name,

      p.created_at,
      p.updated_at

    FROM products p

    INNER JOIN categories c
      ON c.id = p.category_id

    LEFT JOIN brands b
      ON b.id = p.brand_id

    INNER JOIN units u
      ON u.id = p.base_unit_id

    LEFT JOIN users creator
      ON creator.id = p.created_by_id

    LEFT JOIN users updater
      ON updater.id = p.updated_by_id

    WHERE p.id = ?

    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}


// =====================================================
// CREATE PRODUCT
// =====================================================
async function createProduct({
  name,
  categoryId,
  brandId,
  baseUnitId,
  description,
  createdById,
}) {
  // Extra safety check
  if (!name || !String(name).trim()) {
    throw new Error("Product name is required");
  }

  if (!categoryId) {
    throw new Error("Category ID is required");
  }

  if (!baseUnitId) {
    throw new Error("Base unit ID is required");
  }

  const cleanName = String(name).trim();

  const cleanDescription =
    description !== undefined &&
    description !== null &&
    String(description).trim() !== ""
      ? String(description).trim()
      : null;

  const cleanBrandId =
    brandId !== undefined &&
    brandId !== null &&
    brandId !== ""
      ? Number(brandId)
      : null;

  const cleanCategoryId = Number(categoryId);
  const cleanBaseUnitId = Number(baseUnitId);
  const cleanCreatedById = Number(createdById);

  console.log("========== CREATE PRODUCT SERVICE ==========");
  console.log("name:", cleanName);
  console.log("categoryId:", cleanCategoryId);
  console.log("brandId:", cleanBrandId);
  console.log("baseUnitId:", cleanBaseUnitId);
  console.log("description:", cleanDescription);
  console.log("createdById:", cleanCreatedById);
  console.log("============================================");

  const [result] = await pool.query(
    `
    INSERT INTO products (
      name,
      category_id,
      brand_id,
      base_unit_id,
      description,
      is_active,
      created_by_id
    )
    VALUES (?, ?, ?, ?, ?, TRUE, ?)
    `,
    [
      cleanName,
      cleanCategoryId,
      cleanBrandId,
      cleanBaseUnitId,
      cleanDescription,
      cleanCreatedById,
    ]
  );

  return getProductById(result.insertId);
}


// =====================================================
// UPDATE PRODUCT
// =====================================================
async function updateProduct(
  id,
  {
    name,
    categoryId,
    brandId,
    baseUnitId,
    description,
    isActive,
    updatedById,
  }
) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    const cleanName = String(name).trim();

    if (!cleanName) {
      throw new Error("Product name cannot be empty");
    }

    fields.push("name = ?");
    values.push(cleanName);
  }

  if (categoryId !== undefined) {
    fields.push("category_id = ?");
    values.push(Number(categoryId));
  }

  if (brandId !== undefined) {
    fields.push("brand_id = ?");
    values.push(
      brandId === null || brandId === ""
        ? null
        : Number(brandId)
    );
  }

  if (baseUnitId !== undefined) {
    fields.push("base_unit_id = ?");
    values.push(Number(baseUnitId));
  }

  if (description !== undefined) {
    fields.push("description = ?");
    values.push(
      description === null || description === ""
        ? null
        : String(description).trim()
    );
  }

  if (isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(Boolean(isActive));
  }

  fields.push("updated_by_id = ?");
  values.push(Number(updatedById));

  values.push(Number(id));

  await pool.query(
    `
    UPDATE products
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return getProductById(id);
}


// =====================================================
// DELETE PRODUCT - SOFT DELETE
// =====================================================
async function deleteProduct(id, updatedById) {
  const [result] = await pool.query(
    `
    UPDATE products
    SET
      is_active = FALSE,
      updated_by_id = ?
    WHERE id = ?
    `,
    [
      Number(updatedById),
      Number(id),
    ]
  );

  return result.affectedRows > 0;
}


module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};