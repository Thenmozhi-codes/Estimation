const express = require("express");

const categoryController = require("../controllers/category.controller");

const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// Read access - ADMIN + STAFF
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  categoryController.getAllCategories
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "STAFF"),
  categoryController.getCategoryById
);

// Write access - ADMIN only
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  categoryController.createCategory
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  categoryController.updateCategory
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  categoryController.deleteCategory
);

module.exports = router;