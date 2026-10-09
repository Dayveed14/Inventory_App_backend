const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");

const { connectDB } = require("./config/db");

// Import refactored route files
const userApi = require("./routes/User.route");
const assetRoutes = require("./routes/Asset.route");
const logRoutes = require("./routes/Log.route");
const softwareRoutes = require("./routes/Software.route");

// Import shared error handler
const errorMiddleware = require("./middleware/error.middleware");
const AppError = require("./utils/AppError");

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.use("/api/users", userApi);
app.use("/api/assets", assetRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/software", softwareRoutes);


// 404 handler — must come after registered routes
app.use((req, res, next) => {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404
    )
  );
});

// Centralized error handler — must be last
app.use(errorMiddleware);

// Connect to the database before starting the server
async function startServer() {
try {
await connectDB();


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


} catch (error) {
console.error("Failed to start server:", error.message);
process.exit(1);
}
}

startServer();
