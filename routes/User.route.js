const express = require("express");

const router = express.Router();

const userController = require("../controllers/user.controller");

const asyncHandler = require("../middleware/asyncHandler");
const validateObjectId = require("../middleware/validateObjectId");

// Register
router.post(
  "/register",
  asyncHandler(userController.registerUser)
);

// Login
router.post(
  "/login",
  asyncHandler(userController.loginUser)
);

// Get all users
router.get(
  "/",
  asyncHandler(userController.getAllUsers)
);

// Get one user
router.get(
  "/:id",
  validateObjectId,
  asyncHandler(userController.getUserById)
);

// Change password
router.put(
  "/:id/change-password",
  validateObjectId,
  asyncHandler(userController.changePassword)
);

// Update user
router.put(
  "/:id",
  validateObjectId,
  asyncHandler(userController.updateUser)
);

// Delete user
router.delete(
  "/:id",
  validateObjectId,
  asyncHandler(userController.deleteUser)
);

module.exports = router;