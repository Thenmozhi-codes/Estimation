const express = require("express");

const partyController = require("../controllers/party.controller");

const authenticate = require("../middleware/auth.middleware");

const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET ALL PARTIES - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  partyController.getAllParties
);

// GET PARTY BY ID - ADMIN + STAFF
router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  partyController.getPartyById
);

// CREATE PARTY - ADMIN ONLY
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  partyController.createParty
);

// UPDATE PARTY - ADMIN ONLY
router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  partyController.updateParty
);

// DELETE PARTY - ADMIN ONLY
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  partyController.deleteParty
);

module.exports = router;