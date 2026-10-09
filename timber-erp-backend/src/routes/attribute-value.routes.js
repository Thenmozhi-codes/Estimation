const express = require("express");

const attributeValueController = require(
  "../controllers/attribute-value.controller"
);

const authenticate = require(
  "../middleware/auth.middleware"
);

const authorizeRoles = require(
  "../middleware/role.middleware"
);

const router = express.Router();

// =====================================================
// GET ALL ATTRIBUTE VALUES - ADMIN + STAFF
// =====================================================

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  attributeValueController.getAllAttributeValues
);

// =====================================================
// GET ATTRIBUTE VALUE BY ID - ADMIN + STAFF
// =====================================================

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  attributeValueController.getAttributeValueById
);

// =====================================================
// CREATE ATTRIBUTE VALUE - ADMIN ONLY
// =====================================================

router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  attributeValueController.createAttributeValue
);

// =====================================================
// UPDATE ATTRIBUTE VALUE - ADMIN ONLY
// =====================================================

router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  attributeValueController.updateAttributeValue
);

// =====================================================
// DELETE ATTRIBUTE VALUE - ADMIN ONLY
// =====================================================

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  attributeValueController.deleteAttributeValue
);

module.exports = router;