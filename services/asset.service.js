const fs = require("fs/promises");
const XLSX = require("xlsx");

const Asset = require("../model/Asset.model");
const Log = require("../model/Log.model");
const AppError = require("../utils/AppError");

const ASSET_FIELDS = [
  "serialNumber",
  "assetType",
  "model",
  "assetTag",
  "solid",
  "dateAcquired",
  "user",
  "location",
];

const getAssetFields = (data) => {
  const fields = {};

  for (const field of ASSET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      fields[field] = data[field];
    }
  }

  return fields;
};

const createLog = async ({
  action,
  performedBy,
  targetId,
  description,
}) => {
  await Log.create({
    action,
    performedBy: performedBy || "Unknown",
    targetType: "Asset",
    targetId,
    description,
  });
};

const createAsset = async (data) => {
  const { createdBy, ...assetData } = data;

  const asset = await Asset.create({
    ...getAssetFields(assetData),
    createdBy,
  });

  await createLog({
    action: "CREATE_ASSET",
    performedBy: createdBy,
    targetId: asset._id,
    description: `${createdBy || "Unknown"} created a new asset: ${asset.assetTag}`,
  });

  return asset;
};

const getAllAssets = async () => {
  return Asset.find().sort({ createdAt: -1 });
};

const getAssetById = async (id) => {
  const asset = await Asset.findById(id);

  if (!asset) {
    throw new AppError("Asset not found", 404);
  }

  return asset;
};

const updateAsset = async (id, data, performedBy) => {
  const updateData = getAssetFields(data);

  // Preserve the original route's behavior of updating createdBy.
  updateData.createdBy = performedBy;

  const asset = await Asset.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!asset) {
    throw new AppError("Asset not found", 404);
  }

  await createLog({
    action: "UPDATE_ASSET",
    performedBy,
    targetId: asset._id,
    description: `${performedBy || "Unknown"} updated asset ${asset.assetTag}`,
  });

  return asset;
};

const adminUpdateAsset = async (id, data, performedBy) => {
  const existingAsset = await Asset.findById(id);

  if (!existingAsset) {
    throw new AppError("Asset not found", 404);
  }

  const updateData = getAssetFields(data);

  // Admin updates must preserve the original creator.
  updateData.createdBy = existingAsset.createdBy;

  const asset = await Asset.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!asset) {
    throw new AppError("Asset not found", 404);
  }

  await createLog({
    action: "ADMIN_UPDATE_ASSET",
    performedBy,
    targetId: asset._id,
    description: `${performedBy || "Unknown"} (admin) updated asset ${asset.assetTag}`,
  });

  return asset;
};

const deleteAsset = async (id, performedBy) => {
  const asset = await Asset.findByIdAndDelete(id);

  if (!asset) {
    throw new AppError("Asset not found", 404);
  }

  await createLog({
    action: "DELETE_ASSET",
    performedBy,
    targetId: asset._id,
    description: `${performedBy || "Unknown"} deleted asset: ${asset.assetTag}`,
  });

  return asset;
};

const parseAcquisitionDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  // Excel dates may be stored as serial numbers.
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) {
      throw new AppError("Invalid Excel acquisition date", 400);
    }

    return new Date(
      Date.UTC(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H,
        parsed.M,
        Math.floor(parsed.S)
      )
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid acquisition date: ${value}`, 400);
  }

  return date;
};

const uploadAssetsFromExcel = async (filePath, performedBy) => {
  let inserted = [];

  try {
    let workbook;

    try {
      workbook = XLSX.readFile(filePath, {
        cellDates: true,
      });
    } catch {
      throw new AppError("The uploaded file is not a valid Excel workbook", 400);
    }

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new AppError("The Excel workbook contains no worksheets", 400);
    }

    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: true,
    });

    if (!rows.length) {
      throw new AppError("The Excel worksheet contains no asset records", 400);
    }

    if (rows.length > 5000) {
      throw new AppError("A maximum of 5000 assets can be imported at once", 400);
    }

    const assets = rows.map((row, index) => {
      const assetData = getAssetFields(row);

      if (!assetData.assetTag) {
        throw new AppError(
          `Missing assetTag in Excel row ${index + 2}`,
          400
        );
      }

      if (
        Object.prototype.hasOwnProperty.call(row, "dateAcquired")
      ) {
        assetData.dateAcquired = parseAcquisitionDate(row.dateAcquired);
      }

      return {
        ...assetData,
        createdBy: performedBy,
      };
    });

    // ordered: false is intentionally not used; we want predictable
    // behavior if a row fails validation or violates a unique index.
    inserted = await Asset.insertMany(assets);

    // Keep logging behavior consistent with the original endpoint.
    await Log.insertMany(
      inserted.map((asset) => ({
        action: "UPLOAD_EXCEL_ASSETS",
        performedBy: performedBy || "Unknown",
        targetType: "Asset",
        targetId: asset._id,
        description: `${performedBy || "Unknown"} uploaded asset via Excel: ${asset.assetTag}`,
      }))
    );

    return inserted;
  } finally {
    // Remove the temporary upload regardless of success or failure.
    await fs.unlink(filePath).catch(() => {});
  }
};

module.exports = {
  createAsset,
  getAllAssets,
  getAssetById,
  updateAsset,
  adminUpdateAsset,
  deleteAsset,
  uploadAssetsFromExcel,
};