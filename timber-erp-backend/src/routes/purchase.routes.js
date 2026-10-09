const express = require("express");

const controller = require("../controllers/purchase.controller");

const authenticate = require("../middleware/auth.middleware");

const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET ALL PURCHASES - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getAllPurchases
);

// GET PURCHASE BY ID - ADMIN + STAFF
router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.getPurchaseById
);

// CREATE PURCHASE - ADMIN + STAFF
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.createPurchase
);

// UPDATE PURCHASE - ADMIN + STAFF
router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.updatePurchase
);

// RECEIVE PURCHASE - ADMIN + STAFF
router.post(
  "/:id/receive",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.receivePurchase
);

// CANCEL PURCHASE - ADMIN + STAFF
router.post(
  "/:id/cancel",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  controller.cancelPurchase
);

module.exports = router;