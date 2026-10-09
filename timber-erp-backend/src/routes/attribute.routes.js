const express = require("express");

const attributeController = require("../controllers/attribute.controller");

const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// Read access - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  attributeController.getAllAttributes
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  attributeController.getAttributeById
);

// Write access - ADMIN only
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  attributeController.createAttribute
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  attributeController.updateAttribute
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  attributeController.deleteAttribute
);

module.exports = router;