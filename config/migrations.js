const Asset = require("../model/Asset.model");
const Assignment = require("../model/Assignment.model");

// Runs on every startup. Each step only touches records that still need it,
// so running it again does nothing.

// Assets saved before statuses existed: anything with a user is "Assigned"
// (and gets an open assignment record so its history starts somewhere);
// everything else is "In stock".
async function backfillStatuses() {
  const legacyAssigned = await Asset.find(
    { status: { $exists: false }, user: { $nin: [null, ""] } },
    { assetTag: 1, user: 1, solid: 1, location: 1, dateAcquired: 1, createdAt: 1, createdBy: 1, createdById: 1 }
  ).lean();

  if (legacyAssigned.length) {
    await Assignment.insertMany(
      legacyAssigned.map((asset) => ({
        asset: asset._id,
        assetTag: asset.assetTag,
        assignedTo: asset.user,
        solid: asset.solid,
        location: asset.location,
        assignedAt: asset.dateAcquired || asset.createdAt || new Date(),
        assignedBy: asset.createdBy || "Unknown",
        assignedById: asset.createdById,
        notes: "From earlier records",
      }))
    );

    await Asset.updateMany(
      { _id: { $in: legacyAssigned.map((asset) => asset._id) } },
      { $set: { status: "Assigned" } }
    );
  }

  const { modifiedCount } = await Asset.updateMany(
    { status: { $exists: false } },
    { $set: { status: "In stock", user: "" } }
  );

  if (legacyAssigned.length || modifiedCount) {
    console.log(
      `Migration: set status on ${legacyAssigned.length + modifiedCount} existing assets ` +
        `(${legacyAssigned.length} assigned, ${modifiedCount} in stock)`
    );
  }
}

// The unique indexes on asset tag and serial number can't be created while
// duplicates exist. Point them out so they can be fixed.
async function warnAboutDuplicates() {
  for (const field of ["assetTag", "serialNumber"]) {
    const duplicates = await Asset.aggregate([
      { $match: { [field]: { $type: "string", $gt: "" } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ]);

    if (duplicates.length) {
      console.warn(
        `WARNING: duplicate ${field} values found, so the unique ${field} rule can't be ` +
          `enforced by the database until they are fixed: ` +
          duplicates.map((d) => `"${d._id}" (x${d.count})`).join(", ")
      );
    }
  }
}

async function runMigrations() {
  await backfillStatuses();
  await warnAboutDuplicates();
}

module.exports = { runMigrations };
