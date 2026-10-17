const express = require("express");

const router = express.Router();

const Log = require("../model/Log.model");
const asyncHandler = require("../middleware/asyncHandler");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// The activity log is admin-only.
router.use(asyncHandler(protect), restrictTo("admin"));

// GET /api/logs?limit=200
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 500, 2000);

    const logs = await Log.find().sort({ timestamp: -1 }).limit(limit);

    res.status(200).json({
      status: "success",
      count: logs.length,
      data: logs,
    });
  })
);

module.exports = router;
