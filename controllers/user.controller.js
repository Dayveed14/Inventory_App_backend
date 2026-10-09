const userService = require("../services/user.service");

const AppError = require("../utils/AppError");

// POST /api/user/register
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError(
      "Name, email, and password are required",
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

// POST /api/user/login
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
    data: user,
  });
};

// GET /api/user
const getAllUsers = async (req, res) => {
  const users = await userService.getAllUsers();

  res.status(200).json({
    status: "success",
    count: users.length,
    data: users,
  });
};

// GET /api/user/:id
const getUserById = async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  res.status(200).json({
    status: "success",
    data: user,
  });
};

// PUT /api/user/:id
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

// DELETE /api/user/:id
const deleteUser = async (req, res) => {
  await userService.deleteUser(req.params.id);

  res.status(200).json({
    status: "success",
    message: "User deleted successfully",
  });
};

// PUT /api/user/:id/change-password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError(
      "Current password and new password are required",
      400
    );
  }

  if (newPassword.length < 8) {
    throw new AppError(
      "New password must be at least 8 characters long",
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
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
};