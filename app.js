const dns = require("node:dns");

// Use public DNS so MongoDB Atlas SRV lookups work on networks whose
// default resolver can't handle them.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDB } = require("./config/db");
const { runMigrations } = require("./config/migrations");

const userRoutes = require("./routes/User.route");
const assetRoutes = require("./routes/Asset.route");
const logRoutes = require("./routes/Log.route");
const softwareRoutes = require("./routes/Software.route");
const statsRoutes = require("./routes/Stats.route");
const branchRoutes = require("./routes/Branch.route");
const assetTypeRoutes = require("./routes/AssetType.route");

const errorMiddleware = require("./middleware/error.middleware");
const AppError = require("./utils/AppError");

const app = express();
const PORT = process.env.PORT || 4000;

// Render (and most hosts) sit behind one proxy; this gives the rate limiter
// the real client IP instead of the proxy's.
app.set("trust proxy", 1);

// CORS: set CORS_ORIGIN to a comma-separated list of allowed frontend URLs.
// If it is not set, all origins are allowed (fine for local development only).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
              return callback(null, true);
            }
            callback(new AppError(`Origin ${origin} is not allowed by CORS`, 403));
          },
        }
      : undefined
  )
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "success", message: "API is running" });
});

app.use("/api/users", userRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/software", softwareRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/asset-types", assetTypeRoutes);

// 404 handler — must come after registered routes
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// Centralized error handler — must be last
app.use(errorMiddleware);

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
      "JWT_SECRET is missing or shorter than 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
    process.exit(1);
  }

  try {
    await connectDB();
    await runMigrations();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
