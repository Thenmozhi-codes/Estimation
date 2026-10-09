const express = require("express");

const controller = require("../controllers/payment.controller");

const authenticate = require("../middleware/auth.middleware");

const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET ALL PAYMENTS - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getAllPayments
);

// GET PARTY OUTSTANDING - ADMIN + STAFF
router.get(
  "/outstanding/:partyId",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getPartyOutstanding
);

// GET PAYMENT BY ID - ADMIN + STAFF
router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getPaymentById
);

// CREATE PAYMENT - ADMIN + STAFF
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.createPayment
);

module.exports = router;