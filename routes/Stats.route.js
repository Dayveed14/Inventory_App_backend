const express = require("express");

const router = express.Router();

const Asset = require("../model/Asset.model");
const User = require("../model/User.model");
const Software = require("../model/Software.model");
const asyncHandler = require("../middleware/asyncHandler");
const { protect } = require("../middleware/auth.middleware");
const { ownedBy, statusCounts } = require("../services/asset.service");

router.use(asyncHandler(protect));

// GET /api/stats
// Dashboard counts. Regular users can't list all assets or users, so this
// gives them the totals without exposing the records themselves.
// byStatus is scoped like the asset list: all assets for admins, own for users.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [assets, myAssets, users, software, byStatus] = await Promise.all([
      Asset.countDocuments(),
      Asset.countDocuments(ownedBy(req.user)),
      User.countDocuments(),
      Software.countDocuments(),
      statusCounts(req.user),
    ]);

    res.status(200).json({
      status: "success",
      data: { assets, myAssets, users, software, byStatus },
    });
  })
);

module.exports = router;
