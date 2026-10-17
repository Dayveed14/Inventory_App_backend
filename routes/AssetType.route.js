const express = require("express");

const router = express.Router();

const Asset = require("../model/Asset.model");
const AssetType = require("../model/AssetType.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const validateObjectId = require("../middleware/validateObjectId");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { importTypesFromAssets } = require("../services/lookup.service");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sameName = (name) => new RegExp(`^${escapeRegex(name)}$`, "i");

router.use(asyncHandler(protect));

// GET /api/asset-types — active types for dropdowns.
// ?all=true (admin) also returns inactive ones, with how many assets use each.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === "true" && req.user.role === "admin";
    const types = await AssetType.find(includeInactive ? {} : { active: true })
      .sort({ name: 1 })
      .lean();

    if (includeInactive) {
      const usage = await Asset.aggregate([{ $group: { _id: "$assetType", count: { $sum: 1 } } }]);
      const counts = new Map();
      for (const u of usage) {
        const key = String(u._id || "").toLowerCase();
        counts.set(key, (counts.get(key) || 0) + u.count);
      }
      types.forEach((t) => (t.assetCount = counts.get(t.key) || 0));
    }

    res.status(200).json({ status: "success", count: types.length, data: types });
  })
);

router.use(restrictTo("admin"));

// POST /api/asset-types/import-existing — create types from values already on assets
router.post(
  "/import-existing",
  asyncHandler(async (req, res) => {
    const created = await importTypesFromAssets();
    res.status(200).json({
      status: "success",
      message: created ? `Added ${created} asset types from existing assets` : "No new asset types found",
      count: created,
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) throw new AppError("Type name is required", 400);

    const exists = await AssetType.exists({ key: name.toLowerCase() });
    if (exists) throw new AppError(`Asset type "${name}" already exists`, 409);

    const type = await AssetType.create({ name });
    res.status(201).json({ status: "success", message: "Asset type added", data: type });
  })
);

// PUT /api/asset-types/:id { name?, active? }
// Renaming a type also renames it on every asset (any capitalisation).
router.put(
  "/:id",
  validateObjectId,
  asyncHandler(async (req, res) => {
    const type = await AssetType.findById(req.params.id);
    if (!type) throw new AppError("Asset type not found", 404);

    const oldName = type.name;
    const body = req.body || {};
    const name = body.name !== undefined ? String(body.name).trim() : undefined;

    if (name && name.toLowerCase() !== type.key) {
      const clash = await AssetType.exists({ key: name.toLowerCase(), _id: { $ne: type._id } });
      if (clash) throw new AppError(`Asset type "${name}" already exists`, 409);
    }
    if (name) type.name = name;
    if (body.active !== undefined) type.active = Boolean(body.active);

    await type.save();
    // Also tidies up any old spellings ("laptop", "LAPTOP") to the type's name
    await Asset.updateMany(
      { assetType: { $in: [sameName(oldName), sameName(type.name)], $ne: type.name } },
      { $set: { assetType: type.name } }
    );

    res.status(200).json({ status: "success", message: "Asset type updated", data: type });
  })
);

// Only unused types can be deleted; used ones can be deactivated instead.
router.delete(
  "/:id",
  validateObjectId,
  asyncHandler(async (req, res) => {
    const type = await AssetType.findById(req.params.id);
    if (!type) throw new AppError("Asset type not found", 404);

    const inUse = await Asset.countDocuments({ assetType: sameName(type.name) });
    if (inUse) {
      throw new AppError(`${inUse} assets use this type. Deactivate it instead of deleting it.`, 409);
    }

    await type.deleteOne();
    res.status(200).json({ status: "success", message: "Asset type deleted" });
  })
);

module.exports = router;
