const productService = require("../services/product.service");

const categoryService = require("../services/category.service");
const brandService = require("../services/brand.service");
const unitService = require("../services/unit.service");

const { createAuditLog } = require("../services/audit.service");


// =====================================================
// GET ALL PRODUCTS
// =====================================================
async function getAllProducts(req, res) {
  try {
    const products = await productService.getAllProducts();

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
}


// =====================================================
// GET PRODUCT BY ID
// =====================================================
async function getProductById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
}


// =====================================================
// CREATE PRODUCT
// =====================================================
async function createProduct(req, res) {
  try {
    console.log("========================================");
    console.log("CREATE PRODUCT REQUEST");
    console.log("Request Body:", req.body);
    console.log("Logged User:", req.user);
    console.log("========================================");

    const body = req.body || {};

    const name = body.name;
    const categoryId = body.categoryId;
    const brandId = body.brandId;
    const baseUnitId = body.baseUnitId;
    const description = body.description;

    // ---------------------------------------------
    // PRODUCT NAME
    // ---------------------------------------------
    if (
      name === undefined ||
      name === null ||
      String(name).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    const cleanName = String(name).trim();


    // ---------------------------------------------
    // CATEGORY
    // ---------------------------------------------
    const categoryIdNumber = Number(categoryId);

    if (
      !Number.isInteger(categoryIdNumber) ||
      categoryIdNumber <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid category ID is required",
      });
    }


    // ---------------------------------------------
    // BASE UNIT
    // ---------------------------------------------
    const baseUnitIdNumber = Number(baseUnitId);

    if (
      !Number.isInteger(baseUnitIdNumber) ||
      baseUnitIdNumber <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid base unit ID is required",
      });
    }


    // ---------------------------------------------
    // CHECK CATEGORY
    // ---------------------------------------------
    const category =
      await categoryService.getCategoryById(
        categoryIdNumber
      );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }


    // ---------------------------------------------
    // CHECK BASE UNIT
    // ---------------------------------------------
    const unit =
      await unitService.getUnitById(
        baseUnitIdNumber
      );

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Base unit not found",
      });
    }


    // ---------------------------------------------
    // BRAND IS OPTIONAL
    // ---------------------------------------------
    let brandIdNumber = null;

    if (
      brandId !== undefined &&
      brandId !== null &&
      brandId !== ""
    ) {
      brandIdNumber = Number(brandId);

      if (
        !Number.isInteger(brandIdNumber) ||
        brandIdNumber <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid brand ID",
        });
      }

      const brand =
        await brandService.getBrandById(
          brandIdNumber
        );

      if (!brand) {
        return res.status(404).json({
          success: false,
          message: "Brand not found",
        });
      }
    }


    // ---------------------------------------------
    // DESCRIPTION
    // ---------------------------------------------
    let cleanDescription = null;

    if (
      description !== undefined &&
      description !== null &&
      String(description).trim() !== ""
    ) {
      cleanDescription = String(description).trim();
    }


    // ---------------------------------------------
    // USER
    // ---------------------------------------------
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found",
      });
    }


    // ---------------------------------------------
    // CREATE PRODUCT
    // ---------------------------------------------
    console.log("========== CONTROLLER -> SERVICE ==========");
    console.log("name:", cleanName);
    console.log("categoryId:", categoryIdNumber);
    console.log("brandId:", brandIdNumber);
    console.log("baseUnitId:", baseUnitIdNumber);
    console.log("description:", cleanDescription);
    console.log("createdById:", req.user.id);
    console.log("============================================");


    const product =
      await productService.createProduct({
        name: cleanName,
        categoryId: categoryIdNumber,
        brandId: brandIdNumber,
        baseUnitId: baseUnitIdNumber,
        description: cleanDescription,
        createdById: req.user.id,
      });


    // ---------------------------------------------
    // AUDIT LOG
    // ---------------------------------------------
    await createAuditLog({
      req,
      action: "CREATE",
      entity: "products",
      entityId: product.id,
      beforeData: null,
      afterData: product,
    });


    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });

  } catch (error) {
    console.error("========================================");
    console.error("CREATE PRODUCT ERROR");
    console.error(error);
    console.error("Message:", error.message);
    console.error("SQL Code:", error.code);
    console.error("SQL Message:", error.sqlMessage);
    console.error("========================================");

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
}


// =====================================================
// UPDATE PRODUCT
// =====================================================
async function updateProduct(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const existingProduct =
      await productService.getProductById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const {
      name,
      categoryId,
      brandId,
      baseUnitId,
      description,
      isActive,
    } = req.body || {};


    // ---------------------------------------------
    // NAME
    // ---------------------------------------------
    if (name !== undefined) {
      if (
        name === null ||
        String(name).trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot be empty",
        });
      }
    }


    // ---------------------------------------------
    // CATEGORY
    // ---------------------------------------------
    let categoryIdNumber;

    if (categoryId !== undefined) {
      categoryIdNumber = Number(categoryId);

      if (
        !Number.isInteger(categoryIdNumber) ||
        categoryIdNumber <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category =
        await categoryService.getCategoryById(
          categoryIdNumber
        );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }


    // ---------------------------------------------
    // BASE UNIT
    // ---------------------------------------------
    let baseUnitIdNumber;

    if (baseUnitId !== undefined) {
      baseUnitIdNumber = Number(baseUnitId);

      if (
        !Number.isInteger(baseUnitIdNumber) ||
        baseUnitIdNumber <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid base unit ID",
        });
      }

      const unit =
        await unitService.getUnitById(
          baseUnitIdNumber
        );

      if (!unit) {
        return res.status(404).json({
          success: false,
          message: "Base unit not found",
        });
      }
    }


    // ---------------------------------------------
    // BRAND
    // ---------------------------------------------
    let brandIdNumber;

    if (brandId !== undefined) {
      if (
        brandId === null ||
        brandId === ""
      ) {
        brandIdNumber = null;
      } else {
        brandIdNumber = Number(brandId);

        if (
          !Number.isInteger(brandIdNumber) ||
          brandIdNumber <= 0
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid brand ID",
          });
        }

        const brand =
          await brandService.getBrandById(
            brandIdNumber
          );

        if (!brand) {
          return res.status(404).json({
            success: false,
            message: "Brand not found",
          });
        }
      }
    }


    // ---------------------------------------------
    // UPDATE
    // ---------------------------------------------
    const updatedProduct =
      await productService.updateProduct(
        id,
        {
          name:
            name !== undefined
              ? String(name).trim()
              : undefined,

          categoryId:
            categoryId !== undefined
              ? categoryIdNumber
              : undefined,

          brandId:
            brandId !== undefined
              ? brandIdNumber
              : undefined,

          baseUnitId:
            baseUnitId !== undefined
              ? baseUnitIdNumber
              : undefined,

          description:
            description !== undefined
              ? (
                  description === null
                    ? null
                    : String(description).trim()
                )
              : undefined,

          isActive:
            isActive !== undefined
              ? Boolean(isActive)
              : undefined,

          updatedById: req.user.id,
        }
      );


    await createAuditLog({
      req,
      action: "UPDATE",
      entity: "products",
      entityId: id,
      beforeData: existingProduct,
      afterData: updatedProduct,
    });


    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });

  } catch (error) {
    console.error("Update product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
}


// =====================================================
// DELETE PRODUCT
// =====================================================
async function deleteProduct(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const existingProduct =
      await productService.getProductById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }


    const deleted =
      await productService.deleteProduct(
        id,
        req.user.id
      );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }


    const updatedProduct =
      await productService.getProductById(id);


    await createAuditLog({
      req,
      action: "DELETE",
      entity: "products",
      entityId: id,
      beforeData: existingProduct,
      afterData: updatedProduct,
    });


    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });

  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
}


module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};