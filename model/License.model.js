const mongoose = require("mongoose");

const licenseSchema = new mongoose.Schema({
  softwareName: String,
  allowed: Number,
  used: Number,
  licenseType: String, // e.g., Subscription, Perpetual
  expiry: Date,
});

module.exports = mongoose.model("License", licenseSchema);
