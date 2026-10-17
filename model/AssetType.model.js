const mongoose = require("mongoose");

// Asset types managed by admins (Laptop, Desktop, Printer, ...).
const assetTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Type name is required"],
      trim: true,
      unique: true,
    },
    // Lower-cased copy so "laptop" and "Laptop" count as the same type
    key: { type: String, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

assetTypeSchema.pre("validate", function setKey() {
  if (this.name) this.key = this.name.trim().toLowerCase();
});

module.exports = mongoose.model("AssetType", assetTypeSchema);
