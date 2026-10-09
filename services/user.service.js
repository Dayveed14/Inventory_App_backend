const bcrypt = require("bcryptjs");

const User = require("../model/User.model");
const AppError = require("../utils/AppError");

const SALT_ROUNDS = 12;

// Fields that are safe to return to the client.
const sanitizeUser = (user) => {
  const data = user.toObject ? user.toObject() : { ...user };

  delete data.password;
  delete data.__v;

  return data;
};

// Register a new user.
const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new AppError("Email already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    role: "user",
  });

  return sanitizeUser(user);
};

// Authenticate a user.
const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Explicitly select password in case the schema excludes it by default.
  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
  };
};

// Retrieve all users.
const getAllUsers = async () => {
  const users = await User.find()
    .select("-password -__v")
    .sort({ createdAt: -1 });

  return users;
};

// Retrieve one user.
const getUserById = async (id) => {
  const user = await User.findById(id).select("-password -__v");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

// Update a user's basic information.
const updateUser = async (id, { name, email }) => {
  const updateData = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (email !== undefined) {
    updateData.email = email.trim().toLowerCase();
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No valid fields provided for update", 400);
  }

  if (updateData.email) {
    const existingUser = await User.findOne({
      email: updateData.email,
      _id: { $ne: id },
    });

    if (existingUser) {
      throw new AppError("Email already exists", 409);
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  ).select("-password -__v");

  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  return updatedUser;
};

// Delete a user.
const deleteUser = async (id) => {
  const deletedUser = await User.findByIdAndDelete(id);

  if (!deletedUser) {
    throw new AppError("User not found", 404);
  }

  return deletedUser;
};

// Change a user's password.
const changePassword = async (
  id,
  { currentPassword, newPassword }
) => {
  const user = await User.findById(id).select("+password");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isPasswordValid) {
    throw new AppError("Incorrect current password", 401);
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await user.save();

  return {
    message: "Password updated successfully",
  };
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