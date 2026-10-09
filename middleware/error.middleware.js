const AppError = require("../utils/AppError");

const errorMiddleware = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof AppError)) {
    error = Object.assign(
      new AppError(
        error.message || "Internal server error",
        error.statusCode || 500
      ),
      error
    );
  }

  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error";

  // Invalid MongoDB ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource ID";
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    statusCode = 409;

    const field = Object.keys(err.keyValue || {})[0];

    message = field
      ? `${field} already exists`
      : "A record with these details already exists";
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;

    message = Object.values(err.errors)
      .map((item) => item.message)
      .join(", ");
  }

  // Multer errors
  if (err.name === "MulterError") {
    statusCode = 400;

    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File size exceeds the allowed limit";
    } else {
      message = err.message;
    }
  }

  // Unexpected server errors should not expose internal details.
  if (statusCode >= 500) {
    console.error(err);

    if (process.env.NODE_ENV === "production") {
      message = "Internal server error";
    }
  }

  res.status(statusCode).json({
    status: error.status || (statusCode >= 500 ? "error" : "fail"),
    message,
    ...(process.env.NODE_ENV !== "production" &&
      err.stack && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;