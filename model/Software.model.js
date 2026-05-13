const mongoose = require("mongoose");

const softwareSchema = new mongoose.Schema({
  name: String,
  version: String,
  vendor: String,
  category: String,
  licenseCount: Number,
  installDate: Date,
  department: String,
  platforms: [String],
});

module.exports = mongoose.model("Software", softwareSchema);
