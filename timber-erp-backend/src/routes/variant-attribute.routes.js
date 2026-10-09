const express = require("express");

const controller = require(
  "../controllers/variant-attribute.controller"
);

const authenticate = require(
  "../middleware/auth.middleware"
);

const authorizeRoles = require(
  "../middleware/role.middleware"
);

const router = express.Router();

// GET VARIANT ATTRIBUTES - ADMIN + STAFF
router.get(
  "/:variantId",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getVariantAttributes
);

// REPLACE VARIANT ATTRIBUTES - ADMIN ONLY
router.put(
  "/:variantId",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.replaceVariantAttributes
);

module.exports = router;