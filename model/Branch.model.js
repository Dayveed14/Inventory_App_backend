const mongoose = require("mongoose");

// Branches managed by admins. Assets pick a branch from this list so the same
// branch isn't recorded as "Abuja", "abuja" and "ABJ".
const branchSchema = new mongoose.Schema(
  {
    solId: {
      type: String,
      required: [true, "SOL ID is required"],
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
    },
    // Inactive branches stay on old records but can't be chosen for new ones
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Branch", branchSchema);
