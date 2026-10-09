const express = require("express");

const controller = require("../controllers/stock-movement.controller");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

/*
 * IMPORTANT:
 * Specific routes must come before /:id
 */

// GET VARIANT STOCK - ADMIN + STAFF
router.get(
  "/variant/:variantId/stock",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getVariantStock
);

// GET VARIANT MOVEMENTS - ADMIN + STAFF
router.get(
  "/variant/:variantId",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getVariantMovements
);

// GET ALL STOCK MOVEMENTS - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getAllStockMovements
);

// GET STOCK MOVEMENT BY ID - ADMIN + STAFF
router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getStockMovementById
);

// CREATE STOCK MOVEMENT - ADMIN + STAFF
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.createStockMovement
);

module.exports = router;