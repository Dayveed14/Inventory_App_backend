const { rateLimit } = require("express-rate-limit");

// Slows down password guessing against /login and account spam on /register.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

module.exports = { authLimiter };
