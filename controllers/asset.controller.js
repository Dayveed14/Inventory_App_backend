const assetService = require("../services/asset.service");
const AppError = require("../utils/AppError");

// req.user is set by the protect middleware from the JWT, so the server,
// not the client, decides who performed each action.

const createAsset = async (req, res) => {
  const asset = await assetService.createAsset(req.body || {}, req.user);

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

  const assets = await assetService.uploadAssetsFromExcel(req.file.path, req.user);

  res.status(201).json({
    status: "success",
    message: `${assets.length} assets uploaded successfully`,
    count: assets.length,
    data: assets,
  });
};

const getAllAssets = async (req, res) => {
  const { data, total, page, limit } = await assetService.listAssets(req.query, req.user);

  res.status(200).json({
    status: "success",
    count: data.length,
    total,
    page,
    limit,
    data,
  });
};

const getAssetById = async (req, res) => {
  const asset = await assetService.getAssetById(req.params.id, req.user);

  res.status(200).json({ status: "success", data: asset });
};

const updateAsset = async (req, res) => {
  const asset = await assetService.updateAsset(req.params.id, req.body || {}, req.user);

  res.status(200).json({
    status: "success",
    message: "Asset updated successfully",
    data: asset,
  });
};

const deleteAsset = async (req, res) => {
  await assetService.deleteAsset(req.params.id, req.user);

  res.status(200).json({ status: "success", message: "Asset deleted successfully" });
};

const assignAsset = async (req, res) => {
  const asset = await assetService.assignAsset(req.params.id, req.body || {}, req.user);

  res.status(200).json({
    status: "success",
    message: `Asset assigned to ${asset.user}`,
    data: asset,
  });
};

const returnAsset = async (req, res) => {
  const asset = await assetService.returnAsset(req.params.id, req.body || {}, req.user);

  res.status(200).json({
    status: "success",
    message: "Asset returned to stock",
    data: asset,
  });
};

const changeStatus = async (req, res) => {
  const asset = await assetService.changeStatus(req.params.id, req.body || {}, req.user);

  res.status(200).json({
    status: "success",
    message: `Asset is now ${asset.status}`,
    data: asset,
  });
};

const getAssetHistory = async (req, res) => {
  const history = await assetService.getAssetHistory(req.params.id, req.user);

  res.status(200).json({ status: "success", data: history });
};

const getStatuses = (req, res) => {
  res.status(200).json({ status: "success", data: assetService.ASSET_STATUSES });
};

module.exports = {
  createAsset,
  uploadAssetsFromExcel,
  getAllAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  changeStatus,
  getAssetHistory,
  getStatuses,
};
