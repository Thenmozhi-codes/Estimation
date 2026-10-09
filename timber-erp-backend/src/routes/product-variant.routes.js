const express = require("express");

const controller = require("../controllers/product-variant.controller");

const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET ALL VARIANTS - ADMIN + STAFF
router.get(
  "/product/:productId",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getAllVariants
);

// GET VARIANT BY ID - ADMIN + STAFF
router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getVariantById
);

// CREATE VARIANT - ADMIN ONLY
router.post(
  "/product/:productId",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.createVariant
);

// UPDATE VARIANT - ADMIN ONLY
router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.updateVariant
);

// DELETE VARIANT - ADMIN ONLY
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.deleteVariant
);

module.exports = router;