const express = require("express");

const router = express.Router();

const assetController = require("../controllers/asset.controller");
const asyncHandler = require("../middleware/asyncHandler");
const validateObjectId = require("../middleware/validateObjectId");
const upload = require("../middleware/upload.middleware");

// Create asset
router.post(
  "/",
  asyncHandler(assetController.createAsset)
);

// Upload assets from Excel
router.post(
  "/upload-excel",
  upload.single("excel"),
  asyncHandler(assetController.uploadAssetsFromExcel)
);

// Retrieve all assets
router.get(
  "/",
  asyncHandler(assetController.getAllAssets)
);

// Admin update — register before the generic /:id route
router.put(
  "/admin/:id",
  validateObjectId,
  asyncHandler(assetController.adminUpdateAsset)
);

// Retrieve one asset
router.get(
  "/:id",
  validateObjectId,
  asyncHandler(assetController.getAssetById)
);

// Update asset
router.put(
  "/:id",
  validateObjectId,
  asyncHandler(assetController.updateAsset)
);

// Delete asset
router.delete(
  "/:id",
  validateObjectId,
  asyncHandler(assetController.deleteAsset)
);

module.exports = router;