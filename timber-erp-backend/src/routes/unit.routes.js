const express = require("express");

const unitController = require("../controllers/unit.controller");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// Read access - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  unitController.getAllUnits
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  unitController.getUnitById
);

// Write access - ADMIN only
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  unitController.createUnit
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  unitController.updateUnit
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  unitController.deleteUnit
);

module.exports = router;