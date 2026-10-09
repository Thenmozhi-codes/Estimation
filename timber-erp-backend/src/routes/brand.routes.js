const express = require("express");

const brandController = require("../controllers/brand.controller");

const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// Read access - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  brandController.getAllBrands
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  brandController.getBrandById
);

// Write access - ADMIN only
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  brandController.createBrand
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  brandController.updateBrand
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  brandController.deleteBrand
);

module.exports = router;