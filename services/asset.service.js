const fs = require("fs/promises");
const mongoose = require("mongoose");
const XLSX = require("xlsx");

const Asset = require("../model/Asset.model");
const Assignment = require("../model/Assignment.model");
const Log = require("../model/Log.model");
const AppError = require("../utils/AppError");
const { loadLookups, applyLookups } = require("./lookup.service");

const { ASSET_STATUSES } = Asset;

// Fields a client may set when creating or editing an asset. `status` and
// `user` (the assignee) change only through assign/return/changeStatus so
// that every change lands in the history.
const EDITABLE_FIELDS = [
  "serialNumber",
  "assetType",
  "model",
  "assetTag",
  "solid",
  "location",
  "dateAcquired",
];

const MAX_EXCEL_ROWS = 5000;
const MAX_PAGE_SIZE = 200;
const SORTABLE_FIELDS = [
  "assetTag",
  "serialNumber",
  "assetType",
  "model",
  "solid",
  "location",
  "user",
  "status",
  "dateAcquired",
  "createdBy",
  "createdAt",
];

// Status changes allowed through changeStatus. Assigning goes through assign().
const STATUS_TRANSITIONS = {
  "In stock": ["In repair", "Retired"],
  Assigned: ["In stock", "In repair", "Retired"],
  "In repair": ["In stock", "Retired"],
  Retired: ["In stock", "Disposed"],
  Disposed: [],
};

const pick = (data, fields) => {
  const out = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) out[field] = data[field];
  }
  return out;
};

const clean = (value) => (typeof value === "string" ? value.trim() : value);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isAdmin = (actor) => actor.role === "admin";
const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Query that matches assets the actor owns. Records created before owner IDs
// were stored only have the creator's name, so those fall back to a name match.
const ownedBy = (actor) => ({
  $or: [
    { createdById: toObjectId(actor._id) },
    { createdById: { $exists: false }, createdBy: actor.name },
  ],
});

const scopeFor = (actor) => (isAdmin(actor) ? {} : ownedBy(actor));

const canAccess = (asset, actor) => {
  if (isAdmin(actor)) return true;
  if (asset.createdById) return asset.createdById.toString() === actor._id.toString();
  return asset.createdBy === actor.name;
};

const createLog = async ({ action, actor, asset, description }) => {
  await Log.create({
    action,
    performedBy: actor.name,
    performedById: actor._id,
    targetType: "Asset",
    targetId: asset._id,
    description,
  });
};

// Loads an asset and checks the actor may touch it. Returns 404 rather than
// 403 for other people's assets so IDs can't be probed.
const findAccessibleAsset = async (id, actor) => {
  const asset = await Asset.findById(id);

  if (!asset || !canAccess(asset, actor)) {
    throw new AppError("Asset not found", 404);
  }

  return asset;
};

// Friendly error for duplicate tags/serials (the unique index is the backstop).
const assertUnique = async ({ assetTag, serialNumber }, excludeId) => {
  const notSelf = excludeId ? { _id: { $ne: excludeId } } : {};

  if (assetTag) {
    const clash = await Asset.exists({ assetTag: clean(assetTag), ...notSelf });
    if (clash) throw new AppError(`Asset tag "${clean(assetTag)}" is already in use`, 409);
  }

  if (serialNumber) {
    const clash = await Asset.exists({ serialNumber: clean(serialNumber), ...notSelf });
    if (clash) throw new AppError(`Serial number "${clean(serialNumber)}" is already in use`, 409);
  }
};

const openAssignment = (assetId) => Assignment.findOne({ asset: assetId, returnedAt: null });

const closeOpenAssignment = async (asset, actor, returnNotes) => {
  await Assignment.updateOne(
    { asset: asset._id, returnedAt: null },
    {
      $set: {
        returnedAt: new Date(),
        returnedBy: actor.name,
        returnedById: actor._id,
        returnNotes,
      },
    }
  );
};

// ---------------------------------------------------------------- create/read

const createAsset = async (data, actor) => {
  const lookups = await loadLookups();
  const fields = applyLookups(pick(data, EDITABLE_FIELDS), lookups);
  const assignedTo = clean(data.assignedTo || data.user || "");

  await assertUnique(fields);

  const asset = await Asset.create({
    ...fields,
    status: assignedTo ? "Assigned" : "In stock",
    user: assignedTo,
    createdBy: actor.name,
    createdById: actor._id,
  });

  if (assignedTo) {
    await Assignment.create({
      asset: asset._id,
      assetTag: asset.assetTag,
      assignedTo,
      solid: asset.solid,
      location: asset.location,
      assignedBy: actor.name,
      assignedById: actor._id,
      notes: "Assigned when the asset was added",
    });
  }

  await createLog({
    action: "CREATE_ASSET",
    actor,
    asset,
    description: `${actor.name} created a new asset: ${asset.assetTag}`,
  });

  return asset;
};

// GET /assets?search=&status=&assetType=&solid=&page=1&limit=25&sortBy=&order=
// Admins search all assets; regular users only their own.
const listAssets = async (query, actor) => {
  const conditions = [scopeFor(actor)];

  const search = clean(query.search || "");
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    conditions.push({
      $or: ["assetTag", "serialNumber", "model", "user", "location", "solid", "assetType"].map(
        (field) => ({ [field]: pattern })
      ),
    });
  }

  if (query.status) {
    if (!ASSET_STATUSES.includes(query.status)) {
      throw new AppError(`Invalid status filter: ${query.status}`, 400);
    }
    conditions.push({ status: query.status });
  }

  if (query.assetType) {
    conditions.push({ assetType: new RegExp(`^${escapeRegex(clean(query.assetType))}$`, "i") });
  }

  if (query.solid) conditions.push({ solid: clean(query.solid) });

  const filter = { $and: conditions.filter((c) => Object.keys(c).length) };
  if (!filter.$and.length) delete filter.$and;

  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), MAX_PAGE_SIZE);
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const sortBy = SORTABLE_FIELDS.includes(query.sortBy) ? query.sortBy : "createdAt";
  const order = query.order === "asc" ? 1 : -1;

  const [data, total] = await Promise.all([
    Asset.find(filter)
      .sort({ [sortBy]: order, _id: order })
      .skip((page - 1) * limit)
      .limit(limit),
    Asset.countDocuments(filter),
  ]);

  return { data, total, page, limit };
};

const getAssetById = async (id, actor) => findAccessibleAsset(id, actor);

// ---------------------------------------------------------------- edit/delete

const updateAsset = async (id, data, actor) => {
  const asset = await findAccessibleAsset(id, actor);

  if (asset.status === "Disposed") {
    throw new AppError("Disposed assets can no longer be edited", 400);
  }

  const lookups = await loadLookups();
  const fields = applyLookups(pick(data, EDITABLE_FIELDS), lookups);

  await assertUnique(
    {
      assetTag: fields.assetTag !== asset.assetTag ? fields.assetTag : undefined,
      serialNumber: fields.serialNumber !== asset.serialNumber ? fields.serialNumber : undefined,
    },
    asset._id
  );

  // Ownership, status and assignee never change on a plain edit.
  asset.set(fields);
  await asset.save();

  await createLog({
    action: isAdmin(actor) ? "ADMIN_UPDATE_ASSET" : "UPDATE_ASSET",
    actor,
    asset,
    description: `${actor.name}${isAdmin(actor) ? " (admin)" : ""} updated asset ${asset.assetTag}`,
  });

  return asset;
};

const deleteAsset = async (id, actor) => {
  const asset = await findAccessibleAsset(id, actor);

  await asset.deleteOne();
  // History of a deleted asset has nothing to belong to
  await Assignment.deleteMany({ asset: asset._id });

  await createLog({
    action: "DELETE_ASSET",
    actor,
    asset,
    description: `${actor.name} deleted asset: ${asset.assetTag}`,
  });

  return asset;
};

// ---------------------------------------------------------------- lifecycle

// Assign an asset to someone, or transfer it if it's already assigned.
// Optionally moves it to another branch at the same time.
const assignAsset = async (id, { assignedTo, solid, notes }, actor) => {
  const asset = await findAccessibleAsset(id, actor);
  const assignee = clean(assignedTo || "");

  if (!assignee) throw new AppError("Who is the asset being assigned to?", 400);

  const status = asset.status || "In stock";
  if (!["In stock", "Assigned"].includes(status)) {
    throw new AppError(
      `Only assets that are In stock or Assigned can be assigned (this one is ${status})`,
      400
    );
  }

  if (solid !== undefined && solid !== "" && solid !== asset.solid) {
    const lookups = await loadLookups();
    asset.set(applyLookups({ solid }, lookups));
  }

  const isTransfer = status === "Assigned";
  const previous = asset.user;

  if (isTransfer) {
    if (previous === assignee && !asset.isModified("solid")) {
      throw new AppError(`This asset is already assigned to ${assignee}`, 400);
    }
    await closeOpenAssignment(asset, actor, `Transferred to ${assignee}`);
  }

  await Assignment.create({
    asset: asset._id,
    assetTag: asset.assetTag,
    assignedTo: assignee,
    solid: asset.solid,
    location: asset.location,
    notes: clean(notes),
    assignedBy: actor.name,
    assignedById: actor._id,
  });

  asset.status = "Assigned";
  asset.user = assignee;
  await asset.save();

  await createLog({
    action: isTransfer ? "TRANSFER_ASSET" : "ASSIGN_ASSET",
    actor,
    asset,
    description: isTransfer
      ? `${actor.name} transferred asset ${asset.assetTag} from ${previous} to ${assignee}`
      : `${actor.name} assigned asset ${asset.assetTag} to ${assignee}`,
  });

  return asset;
};

// Take an assigned asset back into stock.
const returnAsset = async (id, { notes }, actor) => {
  const asset = await findAccessibleAsset(id, actor);

  if (asset.status !== "Assigned") {
    throw new AppError("Only assigned assets can be returned", 400);
  }

  return changeStatus(asset, { status: "In stock", notes: notes || "Returned" }, actor);
};

// Move an asset to In stock / In repair / Retired / Disposed. Leaving the
// "Assigned" state closes the current assignment.
const changeStatus = async (assetOrId, { status, notes }, actor) => {
  const asset =
    assetOrId instanceof Asset ? assetOrId : await findAccessibleAsset(assetOrId, actor);

  if (!ASSET_STATUSES.includes(status)) {
    throw new AppError(`Status must be one of: ${ASSET_STATUSES.join(", ")}`, 400);
  }

  if (status === "Assigned") {
    throw new AppError("Use assign to give an asset to someone", 400);
  }

  const current = asset.status || "In stock";
  const allowed = STATUS_TRANSITIONS[current] || [];

  if (!allowed.includes(status)) {
    throw new AppError(
      current === "Disposed"
        ? "Disposed assets can't change status"
        : `An asset that is ${current} can't be moved to ${status}` +
          (allowed.length ? ` (allowed: ${allowed.join(", ")})` : ""),
      400
    );
  }

  const previousHolder = asset.user;

  if (current === "Assigned") {
    await closeOpenAssignment(asset, actor, clean(notes) || `Moved to ${status}`);
    asset.user = "";
  }

  asset.status = status;
  await asset.save();

  const isReturn = current === "Assigned" && status === "In stock";

  await createLog({
    action: isReturn ? "RETURN_ASSET" : "CHANGE_ASSET_STATUS",
    actor,
    asset,
    description: isReturn
      ? `${actor.name} took back asset ${asset.assetTag} from ${previousHolder}`
      : `${actor.name} changed asset ${asset.assetTag} from ${current} to ${status}` +
        (clean(notes) ? ` (${clean(notes)})` : ""),
  });

  return asset;
};

const getAssetHistory = async (id, actor) => {
  const asset = await findAccessibleAsset(id, actor);
  const [assignments, events] = await Promise.all([
    Assignment.find({ asset: asset._id }).sort({ assignedAt: -1, _id: -1 }),
    Log.find({ targetId: asset._id }).sort({ timestamp: -1 }).limit(100),
  ]);

  return { assignments, events };
};

// ---------------------------------------------------------------- Excel import

const parseAcquisitionDate = (value, rowNumber) => {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;

  // Excel dates may be stored as serial numbers.
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) throw new AppError(`Invalid acquisition date in Excel row ${rowNumber}`, 400);
    return new Date(
      Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S))
    );
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid acquisition date "${value}" in Excel row ${rowNumber}`, 400);
  }
  return date;
};

// Columns: assetTag (required), serialNumber, assetType, model, solid, location,
// dateAcquired, user (assignee — sets status to Assigned), status (optional).
const uploadAssetsFromExcel = async (filePath, actor) => {
  try {
    let workbook;
    try {
      workbook = XLSX.readFile(filePath, { cellDates: true });
    } catch {
      throw new AppError("The uploaded file is not a valid Excel workbook", 400);
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new AppError("The Excel workbook contains no worksheets", 400);

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: true });

    if (!rows.length) throw new AppError("The Excel worksheet contains no asset records", 400);
    if (rows.length > MAX_EXCEL_ROWS) {
      throw new AppError(`A maximum of ${MAX_EXCEL_ROWS} assets can be imported at once`, 400);
    }

    const lookups = await loadLookups();
    const seenTags = new Map();
    const seenSerials = new Map();

    // Validate every row before inserting anything, so a bad row
    // doesn't leave a half-imported sheet behind.
    const assets = rows.map((row, index) => {
      const rowNumber = index + 2; // +1 for the header row, +1 for 1-based rows
      const where = `in Excel row ${rowNumber}`;
      // Excel gives numbers for cells like "12345"; store text fields as text.
      const raw = {};
      for (const [key, value] of Object.entries(pick(row, EDITABLE_FIELDS))) {
        if (value === null || key === "dateAcquired") continue;
        raw[key] = clean(String(value));
      }

      if (!raw.assetTag) throw new AppError(`Missing assetTag ${where}`, 400);

      const fields = applyLookups(raw, lookups, where);

      if (row.dateAcquired !== undefined) {
        fields.dateAcquired = parseAcquisitionDate(row.dateAcquired, rowNumber);
      }

      if (seenTags.has(fields.assetTag)) {
        throw new AppError(
          `Asset tag "${fields.assetTag}" appears twice (rows ${seenTags.get(fields.assetTag)} and ${rowNumber})`,
          400
        );
      }
      seenTags.set(fields.assetTag, rowNumber);

      if (fields.serialNumber) {
        if (seenSerials.has(fields.serialNumber)) {
          throw new AppError(
            `Serial number "${fields.serialNumber}" appears twice (rows ${seenSerials.get(fields.serialNumber)} and ${rowNumber})`,
            400
          );
        }
        seenSerials.set(fields.serialNumber, rowNumber);
      }

      const assignee = clean(row.user ? String(row.user) : "");
      let status = clean(row.status ? String(row.status) : "") || (assignee ? "Assigned" : "In stock");
      status = ASSET_STATUSES.find((s) => s.toLowerCase() === status.toLowerCase());

      if (!status) {
        throw new AppError(
          `Invalid status "${row.status}" ${where}. Use one of: ${ASSET_STATUSES.join(", ")}`,
          400
        );
      }
      if (status === "Assigned" && !assignee) {
        throw new AppError(`Status is Assigned but no user is given ${where}`, 400);
      }

      return {
        ...fields,
        status,
        user: status === "Assigned" ? assignee : "",
        createdBy: actor.name,
        createdById: actor._id,
        _row: rowNumber,
      };
    });

    // Check the whole sheet against existing records in two queries
    const [tagClash, serialClash] = await Promise.all([
      Asset.findOne({ assetTag: { $in: [...seenTags.keys()] } }, { assetTag: 1 }),
      seenSerials.size
        ? Asset.findOne({ serialNumber: { $in: [...seenSerials.keys()] } }, { serialNumber: 1 })
        : null,
    ]);
    if (tagClash) {
      throw new AppError(
        `Asset tag "${tagClash.assetTag}" in Excel row ${seenTags.get(tagClash.assetTag)} is already in use`,
        409
      );
    }
    if (serialClash) {
      throw new AppError(
        `Serial number "${serialClash.serialNumber}" in Excel row ${seenSerials.get(serialClash.serialNumber)} is already in use`,
        409
      );
    }

    const inserted = await Asset.insertMany(assets.map(({ _row, ...asset }) => asset));

    const assignments = inserted
      .filter((asset) => asset.status === "Assigned")
      .map((asset) => ({
        asset: asset._id,
        assetTag: asset.assetTag,
        assignedTo: asset.user,
        solid: asset.solid,
        location: asset.location,
        assignedBy: actor.name,
        assignedById: actor._id,
        notes: "Imported from Excel",
      }));
    if (assignments.length) await Assignment.insertMany(assignments);

    await Log.insertMany(
      inserted.map((asset) => ({
        action: "UPLOAD_EXCEL_ASSETS",
        performedBy: actor.name,
        performedById: actor._id,
        targetType: "Asset",
        targetId: asset._id,
        description: `${actor.name} uploaded asset via Excel: ${asset.assetTag}`,
      }))
    );

    return inserted;
  } finally {
    // Remove the temporary upload regardless of success or failure.
    await fs.unlink(filePath).catch(() => {});
  }
};

// Counts per status for the dashboard, scoped like the asset list.
const statusCounts = async (actor) => {
  const scope = scopeFor(actor);
  const entries = await Promise.all(
    ASSET_STATUSES.map(async (status) => {
      const filter = Object.keys(scope).length ? { $and: [scope, { status }] } : { status };
      return [status, await Asset.countDocuments(filter)];
    })
  );
  return Object.fromEntries(entries);
};

module.exports = {
  ASSET_STATUSES,
  createAsset,
  listAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  changeStatus,
  getAssetHistory,
  uploadAssetsFromExcel,
  statusCounts,
  ownedBy,
};
