const express = require("express");
const User = require("../model/User.model");
const router = express.Router();
const path = require("path");

// register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send({ status: 404, message: "Email already exists" });
    }

    const user = new User({
      name,
      email,
      password,
      role: role || "user", // default if not sent
    });

    const result = await user.save();

    res.send({
      status: 200,
      message: "User created successfully",
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error saving user" });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
      password: req.body.password,
    });

    if (!user) {
      return res.status(404).send({
        status: 404,
        message: "Invalid email or password",
      });
    }

    // Return only safe fields
    res.status(200).send({
      status: 200,
      message: "Login successful",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "user", // fallback if role is missing
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send({
      status: 500,
      message: "An error occurred during login",
    });
  }
});

// GET all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find();
    res.json({ status: 200, data: users });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Error fetching users" });
  }
});

// GET /api/user/:id
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ data: user });
  } catch (err) {
    res.status(500).json({ message: "Error retrieving User" });
  }
});

// delete
router.delete("/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ status: 200, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Deletion failed" });
  }
});

// PUT /api/users/:id
router.put("/:id", async (req, res) => {
  try {
    const { name, email } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, email },
      { new: true }
    );
    if (!updatedUser)
      return res.status(404).send({ message: "User not found" });

    res
      .status(200)
      .json({ message: "User updated successfully", data: updatedUser });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Error updating user" });
  }
});

// PUT /api/users/:id/change-password
router.put("/:id/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.params.id);

    if (!user || user.password !== currentPassword) {
      return res
        .status(401)
        .json({ status: 401, message: "Incorrect current password" });
    }

    user.password = newPassword;
    await user.save();

    res
      .status(200)
      .json({ status: 200, message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ status: 500, message: "Server error" });
  }
});

module.exports = router;
