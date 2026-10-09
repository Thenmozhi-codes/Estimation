const express = require("express");

const controller = require("../controllers/report.controller");

const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// DASHBOARD REPORT - ADMIN + STAFF
router.get(
  "/dashboard",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getDashboard
);

// SALES REPORT - ADMIN + STAFF
router.get(
  "/sales",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getSalesSummary
);

// PURCHASE REPORT - ADMIN + STAFF
router.get(
  "/purchases",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getPurchaseSummary
);

// STOCK REPORT - ADMIN + STAFF
router.get(
  "/stock",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getStockSummary
);

// OUTSTANDING REPORT - ADMIN + STAFF
router.get(
  "/outstanding",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getOutstandingSummary
);

module.exports = router;