const express = require("express");

const variantPriceController = require(
  "../controllers/variant-price.controller"
);

const authenticate = require(
  "../middleware/auth.middleware"
);

const authorizeRoles = require(
  "../middleware/role.middleware"
);

const router = express.Router();

// =====================================================
// GET ALL PRICES FOR VARIANT - ADMIN + STAFF
// =====================================================

router.get(
  "/variant/:variantId",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  variantPriceController.getVariantPrices
);

// =====================================================
// GET PRICE BY ID - ADMIN + STAFF
// =====================================================

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  variantPriceController.getVariantPriceById
);

// =====================================================
// CREATE PRICE FOR VARIANT - ADMIN ONLY
// =====================================================

router.post(
  "/variant/:variantId",
  authenticate,
  authorizeRoles("ADMIN"),
  variantPriceController.createVariantPrice
);

// =====================================================
// UPDATE PRICE - ADMIN ONLY
// =====================================================

router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  variantPriceController.updateVariantPrice
);

// =====================================================
// DELETE PRICE - ADMIN ONLY
// =====================================================

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  variantPriceController.deleteVariantPrice
);

module.exports = router;