const express = require("express");

const controller = require("../controllers/quotation.controller");

const authenticate = require("../middleware/auth.middleware");

const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET ALL QUOTATIONS - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getAllQuotations
);

// GET QUOTATION BY ID - ADMIN + STAFF
router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getQuotationById
);

// CREATE QUOTATION - ADMIN + STAFF
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.createQuotation
);

// UPDATE QUOTATION - ADMIN + STAFF
router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.updateQuotation
);

// CHANGE QUOTATION STATUS - ADMIN + STAFF
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.changeQuotationStatus
);

module.exports = router;