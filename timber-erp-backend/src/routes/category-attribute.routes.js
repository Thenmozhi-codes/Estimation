const express = require("express");

const controller = require("../controllers/category-attribute.controller");

const authenticate = require("../middleware/auth.middleware");

const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// =====================================================
// GET CATEGORY ATTRIBUTES - ADMIN + STAFF
// =====================================================

router.get(
  "/category/:categoryId",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getCategoryAttributes
);

// =====================================================
// ASSIGN ATTRIBUTE - ADMIN ONLY
// =====================================================

router.post(
  "/category/:categoryId",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.assignAttribute
);

// =====================================================
// UPDATE CATEGORY ATTRIBUTE - ADMIN ONLY
// =====================================================

router.put(
  "/category/:categoryId/attribute/:attributeId",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.updateCategoryAttribute
);

// =====================================================
// REMOVE CATEGORY ATTRIBUTE - ADMIN ONLY
// =====================================================

router.delete(
  "/category/:categoryId/attribute/:attributeId",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.removeAttribute
);

module.exports = router;