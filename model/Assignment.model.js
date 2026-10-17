const mongoose = require("mongoose");

// One record per period an asset was with someone. An open assignment has no
// returnedAt. This answers "who had this asset, where, and when?".
const assignmentSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    // Copied so history still reads correctly if the asset is later edited
    assetTag: String,

    assignedTo: {
      type: String,
      required: [true, "Assignee is required"],
      trim: true,
    },
    solid: { type: String, trim: true },
    location: { type: String, trim: true },
    notes: { type: String, trim: true },

    assignedAt: { type: Date, default: Date.now },
    assignedBy: String,
    assignedById: { type: mongoose.Schema.Types.ObjectId, ref: "user" },

    returnedAt: Date,
    returnedBy: String,
    returnedById: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    returnNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

assignmentSchema.index({ asset: 1, assignedAt: -1 });

module.exports = mongoose.model("Assignment", assignmentSchema);
