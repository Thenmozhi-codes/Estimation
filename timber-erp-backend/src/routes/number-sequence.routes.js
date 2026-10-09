const express = require("express");
const controller = require("../controllers/number-sequence.controller");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.getSequences
);

router.put(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  controller.updateSequence
);

module.exports = router;