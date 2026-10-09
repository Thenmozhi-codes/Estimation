const express = require("express");
const controller = require("../controllers/settings.controller");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.getAllSettings
);

router.get(
  "/:key",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.getSetting
);

router.put(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.upsertSetting
);

module.exports = router;