const mongoose = require("mongoose");

// Lifecycle of an asset.
//   In stock  -> Assigned (via assign), In repair, Retired
//   Assigned  -> Assigned (transfer), In stock (return), In repair, Retired
//   In repair -> In stock, Retired
//   Retired   -> In stock, Disposed
//   Disposed  -> (final)
const ASSET_STATUSES = ["In stock", "Assigned", "In repair", "Retired", "Disposed"];

const assetSchema = new mongoose.Schema(
  {
    serialNumber: { type: String, trim: true },
    assetType: { type: String, trim: true },
    model: { type: String, trim: true },
    assetTag: {
      type: String,
      required: [true, "Asset tag is required"],
      trim: true,
    },
    // Branch SOL ID and branch name. When branches are set up under Settings,
    // these are filled from the chosen branch.
    solid: { type: String, trim: true },
    location: { type: String, trim: true },
    dateAcquired: Date,

    status: {
      type: String,
      enum: { values: ASSET_STATUSES, message: "Invalid status: {VALUE}" },
      default: "In stock",
    },
    // Who currently has the asset. Only changed through assign/return so
    // every change is recorded in the assignment history.
    user: { type: String, trim: true, default: "" },

    // Display name of whoever created the asset (kept for the UI and older records)
    createdBy: String,
    // Reliable owner reference used for permission checks
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      index: true,
    },
  },
  { timestamps: true }
);

// No two assets may share a tag, or a serial number (blank serials allowed).
assetSchema.index({ assetTag: 1 }, { unique: true });
assetSchema.index(
  { serialNumber: 1 },
  { unique: true, partialFilterExpression: { serialNumber: { $type: "string", $gt: "" } } }
);
assetSchema.index({ status: 1 });
assetSchema.index({ solid: 1 });
assetSchema.index({ assetType: 1 });

const Asset = mongoose.model("Asset", assetSchema);

module.exports = Asset;
module.exports.ASSET_STATUSES = ASSET_STATUSES;
