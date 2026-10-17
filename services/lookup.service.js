const Asset = require("../model/Asset.model");
const AssetType = require("../model/AssetType.model");
const Branch = require("../model/Branch.model");
const AppError = require("../utils/AppError");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Asset types and branches are enforced only once an admin has added at least
// one of them. Until then, free text is accepted as before, so existing data
// and Excel imports keep working while the lists are being set up.

// Loads the lists once so a large Excel import doesn't query per row.
const loadLookups = async () => {
  const [types, branches] = await Promise.all([
    AssetType.find({ active: true }).lean(),
    Branch.find({ active: true }).lean(),
  ]);

  return {
    typesEnforced: (await AssetType.estimatedDocumentCount()) > 0,
    branchesEnforced: (await Branch.estimatedDocumentCount()) > 0,
    typesByKey: new Map(types.map((t) => [t.key, t.name])),
    branchesBySolId: new Map(branches.map((b) => [b.solId.toLowerCase(), b])),
  };
};

// Applies the lists to asset fields: returns the canonical type name, and the
// branch's SOL ID and name. `where` is added to error messages (e.g. "in Excel row 4").
const applyLookups = (fields, lookups, where = "") => {
  const result = { ...fields };
  const suffix = where ? ` ${where}` : "";

  if (lookups.typesEnforced && result.assetType !== undefined && result.assetType !== "") {
    const name = lookups.typesByKey.get(String(result.assetType).trim().toLowerCase());

    if (!name) {
      throw new AppError(
        `Unknown asset type "${result.assetType}"${suffix}. An admin can add it under Settings.`,
        400
      );
    }
    result.assetType = name;
  }

  if (lookups.branchesEnforced && result.solid !== undefined && result.solid !== "") {
    const branch = lookups.branchesBySolId.get(String(result.solid).trim().toLowerCase());

    if (!branch) {
      throw new AppError(
        `Unknown branch SOL ID "${result.solid}"${suffix}. An admin can add it under Settings.`,
        400
      );
    }
    result.solid = branch.solId;
    result.location = branch.name;
  }

  return result;
};

// Builds the lists from what's already in the assets collection, so an admin
// doesn't have to type them all in. Existing entries are left alone.
const importTypesFromAssets = async () => {
  const names = await Asset.distinct("assetType");
  const existing = new Set((await AssetType.find().lean()).map((t) => t.key));
  const toCreate = new Map();

  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim() : "";
    const key = name.toLowerCase();
    if (name && !existing.has(key) && !toCreate.has(key)) toCreate.set(key, name);
  }

  // create() one at a time so the pre-validate hook sets `key`
  for (const name of toCreate.values()) await AssetType.create({ name });

  // Make every asset use the exact spelling of its type ("laptop" -> "Laptop")
  for (const type of await AssetType.find().lean()) {
    await Asset.updateMany(
      { assetType: { $regex: `^${escapeRegex(type.name)}$`, $options: "i", $ne: type.name } },
      { $set: { assetType: type.name } }
    );
  }

  return toCreate.size;
};

const importBranchesFromAssets = async () => {
  const assets = await Asset.find({ solid: { $nin: [null, ""] } }, { solid: 1, location: 1 })
    .sort({ createdAt: -1 })
    .lean();
  const existing = new Set((await Branch.find().lean()).map((b) => b.solId.toLowerCase()));
  const toCreate = new Map();

  for (const { solid, location } of assets) {
    const solId = String(solid).trim();
    const key = solId.toLowerCase();
    if (!solId || existing.has(key) || toCreate.has(key)) continue;
    // Use the most recent location seen for this SOL ID as the branch name
    toCreate.set(key, { solId, name: (location || "").trim() || `Branch ${solId}` });
  }

  if (toCreate.size) await Branch.insertMany([...toCreate.values()]);

  return toCreate.size;
};

module.exports = {
  loadLookups,
  applyLookups,
  importTypesFromAssets,
  importBranchesFromAssets,
};
