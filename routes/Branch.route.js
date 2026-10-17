const express = require("express");

const router = express.Router();

const Asset = require("../model/Asset.model");
const Branch = require("../model/Branch.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const validateObjectId = require("../middleware/validateObjectId");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { importBranchesFromAssets } = require("../services/lookup.service");

router.use(asyncHandler(protect));

// GET /api/branches — active branches for dropdowns.
// ?all=true (admin) also returns inactive ones, with how many assets use each.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === "true" && req.user.role === "admin";
    const branches = await Branch.find(includeInactive ? {} : { active: true })
      .sort({ name: 1 })
      .lean();

    if (includeInactive) {
      const usage = await Asset.aggregate([{ $group: { _id: "$solid", count: { $sum: 1 } } }]);
      const counts = new Map(usage.map((u) => [u._id, u.count]));
      branches.forEach((b) => (b.assetCount = counts.get(b.solId) || 0));
    }

    res.status(200).json({ status: "success", count: branches.length, data: branches });
  })
);

router.use(restrictTo("admin"));

// POST /api/branches/import-existing — create branches from SOL IDs already on assets
router.post(
  "/import-existing",
  asyncHandler(async (req, res) => {
    const created = await importBranchesFromAssets();
    res.status(200).json({
      status: "success",
      message: created ? `Added ${created} branches from existing assets` : "No new branches found",
      count: created,
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { solId, name } = req.body || {};
    if (!solId || !name) throw new AppError("SOL ID and branch name are required", 400);

    const exists = await Branch.exists({ solId: String(solId).trim() });
    if (exists) throw new AppError(`SOL ID ${solId} already exists`, 409);

    const branch = await Branch.create({ solId, name });
    res.status(201).json({ status: "success", message: "Branch added", data: branch });
  })
);

// PUT /api/branches/:id { solId?, name?, active? }
// Renaming a branch or changing its SOL ID updates the assets that use it.
router.put(
  "/:id",
  validateObjectId,
  asyncHandler(async (req, res) => {
    const branch = await Branch.findById(req.params.id);
    if (!branch) throw new AppError("Branch not found", 404);

    const oldSolId = branch.solId;
    const { solId, name, active } = req.body || {};

    if (solId !== undefined && String(solId).trim() !== oldSolId) {
      const clash = await Branch.exists({ solId: String(solId).trim(), _id: { $ne: branch._id } });
      if (clash) throw new AppError(`SOL ID ${solId} already exists`, 409);
      branch.solId = solId;
    }
    if (name !== undefined) branch.name = name;
    if (active !== undefined) branch.active = Boolean(active);

    await branch.save();
    await Asset.updateMany(
      { solid: oldSolId },
      { $set: { solid: branch.solId, location: branch.name } }
    );

    res.status(200).json({ status: "success", message: "Branch updated", data: branch });
  })
);

// Only unused branches can be deleted; used ones can be deactivated instead.
router.delete(
  "/:id",
  validateObjectId,
  asyncHandler(async (req, res) => {
    const branch = await Branch.findById(req.params.id);
    if (!branch) throw new AppError("Branch not found", 404);

    const inUse = await Asset.countDocuments({ solid: branch.solId });
    if (inUse) {
      throw new AppError(
        `${inUse} assets belong to this branch. Deactivate it instead of deleting it.`,
        409
      );
    }

    await branch.deleteOne();
    res.status(200).json({ status: "success", message: "Branch deleted" });
  })
);

module.exports = router;
