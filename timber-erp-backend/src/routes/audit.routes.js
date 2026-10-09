const express = require("express");

const controller = require("../controllers/audit.controller");

const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// AUDIT LOGS - ADMIN ONLY
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.getAllAuditLogs
);

module.exports = router;