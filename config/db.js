const mongoose = require("mongoose");

async function connectDB() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set. Copy .env.example to .env and fill it in.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected successfully");
}

module.exports = { connectDB };
