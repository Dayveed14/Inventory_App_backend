const express = require("express");
const Asset = require("../model/Asset.model");
const multer = require("multer");
const XLSX = require("xlsx");
const router = express.Router();
const upload = multer({ dest: "uploads/" });
const Log = require("../model/Log.model");
const moment = require("moment");

// POST /api/assets
router.post("/", async (req, res) => {
  try {
    const asset = new Asset(req.body);
    const result = await asset.save();

    await Log.create({
      action: "CREATE_ASSET",
      performedBy: req.body.createdBy,
      targetType: "Asset",
      targetId: result._id,
      description: `${req.body.createdBy} created a new asset: ${result.assetTag}`,
    });

    res.send({ status: 200, data: result });
  } catch (error) {
    console.error("Error creating asset:", error);
    res.status(500).send({ message: "Asset save failed" });
  }
});

// POST EXCEL /api/assets

router.post("/upload-excel", upload.single("excel"), async (req, res) => {
  try {
    const performedBy = req.headers["x-user-name"];

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    let jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Fix potential 1970 issue and add createdBy
    jsonData = jsonData.map((item) => {
      let fixedDate = null;

      if (item.dateAcquired) {
        const parsedDate = new Date(item.dateAcquired);
        if (!isNaN(parsedDate)) {
          fixedDate = parsedDate;
        }
      }

      return {
        ...item,
        createdBy: performedBy,
        dateAcquired: fixedDate,
      };
    });
    const inserted = await Asset.insertMany(jsonData);

    // Log each upload (optional: change to 1 summary log)
    await Promise.all(
      inserted.map((asset) =>
        Log.create({
          action: "UPLOAD_EXCEL_ASSETS",
          performedBy,
          targetType: "Asset",
          targetId: asset._id,
          description: `${performedBy} uploaded asset via Excel: ${asset.assetTag}`,
        })
      )
    );

    res.send({ status: 200, message: "Assets uploaded", data: inserted });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Excel upload failed" });
  }
});

// GET all assets
router.get("/", async (req, res) => {
  try {
    const assets = await Asset.find();
    res.status(200).json({ data: assets });
  } catch (err) {
    res.status(500).json({ message: "Error retrieving assets" });
  }
});

// GET /api/assets/:id
router.get("/:id", async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }
    res.status(200).json({ data: asset });
  } catch (err) {
    res.status(500).json({ message: "Error retrieving asset" });
  }
});

// delete
router.delete("/:id", async (req, res) => {
  try {
    const deletedAsset = await Asset.findByIdAndDelete(req.params.id);

    if (!deletedAsset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    const { performedBy } = req.body;

    await Log.create({
      action: "DELETE_ASSET",
      performedBy: performedBy || "Unknown",
      targetType: "Asset",
      targetId: deletedAsset._id,
      description: `${performedBy} deleted asset: ${deletedAsset.assetTag}`,
    });

    res.json({ status: 200, message: "Deleted successfully" });
  } catch (err) {
    console.error("Error deleting asset:", err);
    res.status(500).json({ message: "Deletion failed" });
  }
});

// PUT /api/assets/:id
router.put("/:id", async (req, res) => {
  try {
    const createdBy = req.headers["x-user-name"]; // 👈 read from header
    const performedBy = createdBy;

    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      {
        serialNumber: req.body.serialNumber,
        assetType: req.body.assetType,
        model: req.body.model,
        assetTag: req.body.assetTag,
        solid: req.body.solid,
        dateAcquired: req.body.dateAcquired,
        user: req.body.user,
        location: req.body.location,
        createdBy: createdBy, // 👈 use the header value
      },
      { new: true }
    );

    if (!updatedAsset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    // Log the update
    await Log.create({
      action: "UPDATE_ASSET",
      performedBy,
      targetType: "Asset",
      targetId: updatedAsset._id,
      description: `${performedBy} updated asset ${updatedAsset.assetTag}`,
    });
    res.status(200).json({
      message: "Asset updated successfully",
      data: updatedAsset,
    });
  } catch (error) {
    console.error("Error updating asset:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/assets/admin/:id
router.put("/admin/:id", async (req, res) => {
  try {
    const performedBy = req.headers["x-user-name"]; // logged-in admin

    // First, fetch the original asset to preserve the original 'createdBy'
    const existingAsset = await Asset.findById(req.params.id);
    if (!existingAsset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    // Update asset but keep 'createdBy' unchanged
    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      {
        serialNumber: req.body.serialNumber,
        assetType: req.body.assetType,
        model: req.body.model,
        assetTag: req.body.assetTag,
        solid: req.body.solid,
        dateAcquired: req.body.dateAcquired,
        user: req.body.user,
        location: req.body.location,
        createdBy: existingAsset.createdBy, // preserve original
      },
      { new: true }
    );

    // Log the admin update
    await Log.create({
      action: "ADMIN_UPDATE_ASSET",
      performedBy,
      targetType: "Asset",
      targetId: updatedAsset._id,
      description: `${performedBy} (admin) updated asset ${updatedAsset.assetTag}`,
    });

    res.status(200).json({
      message: "Asset updated by admin successfully",
      data: updatedAsset,
    });
  } catch (error) {
    console.error("Error in admin update:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
