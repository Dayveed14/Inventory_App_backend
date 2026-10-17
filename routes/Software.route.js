const express = require("express");

const router = express.Router();

const Software = require("../model/Software.model");
const asyncHandler = require("../middleware/asyncHandler");
const { protect, restrictTo } = require("../middleware/auth.middleware");

const SOFTWARE_FIELDS = [
  "name",
  "version",
  "vendor",
  "category",
  "licenseCount",
  "installDate",
  "department",
  "platforms",
];

const pick = (data) =>
  Object.fromEntries(
    SOFTWARE_FIELDS.filter((field) => data[field] !== undefined).map((field) => [
      field,
      data[field],
    ])
  );

router.use(asyncHandler(protect));

// GET /api/software - any logged-in user
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const software = await Software.find().sort({ name: 1 });

    res.status(200).json({
      status: "success",
      count: software.length,
      data: software,
    });
  })
);

// POST /api/software - admin only
router.post(
  "/",
  restrictTo("admin"),
  asyncHandler(async (req, res) => {
    const software = await Software.create(pick(req.body));

    res.status(201).json({
      status: "success",
      message: "Software added successfully",
      data: software,
    });
  })
);

module.exports = router;
