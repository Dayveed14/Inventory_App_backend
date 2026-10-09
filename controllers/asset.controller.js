const assetService = require("../services/asset.service");
const AppError = require("../utils/AppError");

const createAsset = async (req, res) => {
  const asset = await assetService.createAsset(req.body);

  res.status(201).json({
    status: "success",
    message: "Asset created successfully",
    data: asset,
  });
};

const uploadAssetsFromExcel = async (req, res) => {
  if (!req.file) {
    throw new AppError("Please upload an Excel file", 400);
  }

  const performedBy = req.headers["x-user-name"];

  const assets = await assetService.uploadAssetsFromExcel(
    req.file.path,
    performedBy
  );

  res.status(201).json({
    status: "success",
    message: "Assets uploaded successfully",
    count: assets.length,
    data: assets,
  });
};

const getAllAssets = async (req, res) => {
  const assets = await assetService.getAllAssets();

  res.status(200).json({
    status: "success",
    count: assets.length,
    data: assets,
  });
};

const getAssetById = async (req, res) => {
  const asset = await assetService.getAssetById(req.params.id);

  res.status(200).json({
    status: "success",
    data: asset,
  });
};

const updateAsset = async (req, res) => {
  const performedBy = req.headers["x-user-name"];

  const asset = await assetService.updateAsset(
    req.params.id,
    req.body,
    performedBy
  );

  res.status(200).json({
    status: "success",
    message: "Asset updated successfully",
    data: asset,
  });
};

const adminUpdateAsset = async (req, res) => {
  const performedBy = req.headers["x-user-name"];

  const asset = await assetService.adminUpdateAsset(
    req.params.id,
    req.body,
    performedBy
  );

  res.status(200).json({
    status: "success",
    message: "Asset updated by admin successfully",
    data: asset,
  });
};

const deleteAsset = async (req, res) => {
  const performedBy =
    req.headers["x-user-name"] || req.body.performedBy || "Unknown";

  await assetService.deleteAsset(req.params.id, performedBy);

  res.status(200).json({
    status: "success",
    message: "Asset deleted successfully",
  });
};

module.exports = {
  createAsset,
  uploadAssetsFromExcel,
  getAllAssets,
  getAssetById,
  updateAsset,
  adminUpdateAsset,
  deleteAsset,
};