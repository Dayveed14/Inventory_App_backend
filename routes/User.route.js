const express = require("express");

const router = express.Router();

const userController = require("../controllers/user.controller");
const asyncHandler = require("../middleware/asyncHandler");
const validateObjectId = require("../middleware/validateObjectId");
const { protect, restrictTo, selfOrAdmin } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimit.middleware");

// Public
router.post("/register", authLimiter, asyncHandler(userController.registerUser));
router.post("/login", authLimiter, asyncHandler(userController.loginUser));

// Everything below requires a valid token
router.use(asyncHandler(protect));

// The logged-in user's own profile
router.get("/me", asyncHandler(userController.getMe));

// Admin only: list all users, delete a user
router.get("/", restrictTo("admin"), asyncHandler(userController.getAllUsers));
router.delete(
  "/:id",
  validateObjectId,
  restrictTo("admin"),
  asyncHandler(userController.deleteUser)
);

// A user can view and edit themselves; admins can view and edit anyone
router.get("/:id", validateObjectId, selfOrAdmin, asyncHandler(userController.getUserById));
router.put("/:id", validateObjectId, selfOrAdmin, asyncHandler(userController.updateUser));

// Only the account owner can change their password (it requires the current one)
router.put(
  "/:id/change-password",
  validateObjectId,
  asyncHandler(userController.changePassword)
);

module.exports = router;
