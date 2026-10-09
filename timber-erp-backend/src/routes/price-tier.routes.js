const express = require("express");

const priceTierController = require(
  "../controllers/price-tier.controller"
);

const authenticate = require(
  "../middleware/auth.middleware"
);

const authorizeRoles = require(
  "../middleware/role.middleware"
);

const router = express.Router();

// GET ALL - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  priceTierController.getAllPriceTiers
);

// GET BY ID - ADMIN + STAFF
router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  priceTierController.getPriceTierById
);

// CREATE - ADMIN ONLY
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  priceTierController.createPriceTier
);

// UPDATE - ADMIN ONLY
router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  priceTierController.updatePriceTier
);

// DELETE - ADMIN ONLY
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  priceTierController.deletePriceTier
);

module.exports = router;