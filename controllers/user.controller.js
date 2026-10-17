const userService = require("../services/user.service");

const AppError = require("../utils/AppError");
const { signToken } = require("../middleware/auth.middleware");

const MIN_PASSWORD_LENGTH = 8;

// POST /api/users/register
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError(
      "Name, email, and password are required",
      400
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      400
    );
  }

  const user = await userService.registerUser({
    name,
    email,
    password,
  });

  res.status(201).json({
    status: "success",
    message: "User created successfully",
    data: user,
  });
};

// POST /api/users/login
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(
      "Email and password are required",
      400
    );
  }

  const user = await userService.loginUser({
    email,
    password,
  });

  res.status(200).json({
    status: "success",
    message: "Login successful",
    token: signToken(user),
    data: user,
  });
};

// GET /api/users/me
const getMe = async (req, res) => {
  res.status(200).json({
    status: "success",
    data: req.user,
  });
};

// GET /api/users
const getAllUsers = async (req, res) => {
  const users = await userService.getAllUsers();

  res.status(200).json({
    status: "success",
    count: users.length,
    data: users,
  });
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  res.status(200).json({
    status: "success",
    data: user,
  });
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  const user = await userService.updateUser(
    req.params.id,
    req.body
  );

  res.status(200).json({
    status: "success",
    message: "User updated successfully",
    data: user,
  });
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  if (req.user._id.toString() === req.params.id) {
    throw new AppError("You cannot delete your own account", 400);
  }

  await userService.deleteUser(req.params.id);

  res.status(200).json({
    status: "success",
    message: "User deleted successfully",
  });
};

// PUT /api/users/:id/change-password
const changePassword = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    throw new AppError("You can only change your own password", 403);
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError(
      "Current password and new password are required",
      400
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      `New password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      400
    );
  }

  const result = await userService.changePassword(
    req.params.id,
    {
      currentPassword,
      newPassword,
    }
  );

  res.status(200).json({
    status: "success",
    ...result,
  });
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
};