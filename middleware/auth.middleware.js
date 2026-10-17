const jwt = require("jsonwebtoken");

const User = require("../model/User.model");
const AppError = require("../utils/AppError");

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

// Requires a valid "Authorization: Bearer <token>" header.
// Loads the user from the database on every request so that deleted users
// and role changes take effect immediately, not when the token expires.
const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError("You are not logged in", 401));
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new AppError("Your session is invalid or has expired. Please log in again.", 401));
  }

  const user = await User.findById(payload.id).select("-password -__v");

  if (!user) {
    return next(new AppError("This account no longer exists", 401));
  }

  req.user = user;
  next();
};

// Use after protect: restrictTo("admin")
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError("You do not have permission to perform this action", 403));
  }

  next();
};

// Use after protect on /:id routes: the user may act on their own account,
// admins may act on anyone's.
const selfOrAdmin = (req, res, next) => {
  if (req.user.role === "admin" || req.user._id.toString() === req.params.id) {
    return next();
  }

  next(new AppError("You do not have permission to perform this action", 403));
};

module.exports = { signToken, protect, restrictTo, selfOrAdmin };
