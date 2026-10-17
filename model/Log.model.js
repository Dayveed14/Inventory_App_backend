const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  action: { type: String, required: true },
  performedBy: { type: String, required: true },
  performedById: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  targetType: { type: String },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  description: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("Log", logSchema);
