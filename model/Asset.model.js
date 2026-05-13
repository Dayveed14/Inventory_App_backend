const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema({
  serialNumber: String,
  assetType: String,
  model: String,
  assetTag: String,
  solid: String,
  dateAcquired: Date,
  user: String,
  location: String,
  createdBy: String,
});

module.exports = mongoose.model("Asset", assetSchema);
