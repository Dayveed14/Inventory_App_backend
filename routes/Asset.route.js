const express = require("express");

const router = express.Router();

const assetController = require("../controllers/asset.controller");
const asyncHandler = require("../middleware/asyncHandler");
const validateObjectId = require("../middleware/validateObjectId");
const upload = require("../middleware/upload.middleware");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Every asset route requires a logged-in user. Admins can see and change all
// assets; regular users only their own (enforced in the asset service).
router.use(asyncHandler(protect));

router.get("/statuses", assetController.getStatuses);

router.post("/", asyncHandler(assetController.createAsset));

router.post(
  "/upload-excel",
  upload.single("excel"),
  asyncHandler(assetController.uploadAssetsFromExcel)
);

// ?search=&status=&assetType=&solid=&page=&limit=&sortBy=&order=asc|desc
router.get("/", asyncHandler(assetController.getAllAssets));

// Kept for the admin screens; behaves like PUT /:id but is admin-only.
// Registered before /:id so "admin" isn't treated as an ID.
router.put(
  "/admin/:id",
  validateObjectId,
  restrictTo("admin"),
  asyncHandler(assetController.updateAsset)
);

router.get("/:id", validateObjectId, asyncHandler(assetController.getAssetById));
router.put("/:id", validateObjectId, asyncHandler(assetController.updateAsset));
router.delete("/:id", validateObjectId, asyncHandler(assetController.deleteAsset));

// Lifecycle
router.get("/:id/history", validateObjectId, asyncHandler(assetController.getAssetHistory));
router.post("/:id/assign", validateObjectId, asyncHandler(assetController.assignAsset));
router.post("/:id/return", validateObjectId, asyncHandler(assetController.returnAsset));
router.post("/:id/status", validateObjectId, asyncHandler(assetController.changeStatus));

module.exports = router;
