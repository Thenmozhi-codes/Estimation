const express = require("express");

const controller =
  require("../controllers/user.controller");

const authenticate =
  require("../middleware/auth.middleware");

const authorizeRoles =
  require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("ADMIN"));

router.get(
  "/",
  controller.getAllUsers
);

router.get(
  "/:id",
  controller.getUserById
);

router.post(
  "/",
  controller.createUser
);

router.put(
  "/:id",
  controller.updateUser
);

router.patch(
  "/:id/status",
  controller.updateUserStatus
);

router.patch(
  "/:id/password",
  controller.resetPassword
);

module.exports = router;