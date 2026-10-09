const express = require("express");

const controller = require("../controllers/invoice.controller");

const authenticate = require("../middleware/auth.middleware");

const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET ALL INVOICES - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getAllInvoices
);

// GET INVOICE BY ID - ADMIN + STAFF
router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getInvoiceById
);

// CREATE INVOICE - ADMIN + STAFF
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.createInvoice
);

// UPDATE INVOICE - ADMIN + STAFF
router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.updateInvoice
);

// CONFIRM INVOICE - ADMIN + STAFF
router.post(
  "/:id/confirm",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.confirmInvoice
);

// CANCEL INVOICE - ADMIN + STAFF
router.post(
  "/:id/cancel",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.cancelInvoice
);

module.exports = router;