const express = require("express");

const productController = require("../controllers/product.controller");

const authenticate = require("../middleware/auth.middleware");

const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

const validate = require("../middleware/validate.middleware");

const {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
} = require("../validations/product.validation");



// =====================================================
// GET ALL PRODUCTS - ADMIN + STAFF
// =====================================================

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  validate(productIdSchema),
  productController.getProductById
);

// =====================================================
// GET PRODUCT BY ID - ADMIN + STAFF
// =====================================================

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  productController.getProductById
);

// =====================================================
// CREATE PRODUCT - ADMIN ONLY
// =====================================================

router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  validate(createProductSchema),
  productController.createProduct
);
// =====================================================
// UPDATE PRODUCT - ADMIN ONLY
// =====================================================

router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  validate(productIdSchema),
  validate(updateProductSchema),
  productController.updateProduct
);

// =====================================================
// DELETE PRODUCT - ADMIN ONLY
// =====================================================

// DELETE PRODUCT - ADMIN ONLY
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  validate(productIdSchema),
  productController.deleteProduct
);

module.exports = router;