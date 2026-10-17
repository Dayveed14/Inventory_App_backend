# Inventory App — Backend

REST API for the IT asset and software inventory system. Node.js, Express 5, MongoDB (Mongoose), JWT auth.

Frontend: https://github.com/Dayveed14/Inventory_App

## Run locally

```bash
npm install
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm run dev               # or: npm start
```

Generate a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server refuses to start without `MONGO_URI` and a `JWT_SECRET` of at least 32 characters.

### Create the first admin

Sign-up always creates regular users. To make an admin:

```bash
# promote an existing account
npm run create-admin -- you@example.com

# or create a new admin account
npm run create-admin -- admin@example.com 'StrongPass123' 'Jane Admin'
```

## Authentication

`POST /api/users/login` returns a `token`. Send it on every other request:

```
Authorization: Bearer <token>
```

Tokens expire after `JWT_EXPIRES_IN` (default 8h). Login and register are rate-limited to 20 attempts per 15 minutes per IP.

## Permissions

| Area | Regular user | Admin |
|---|---|---|
| Assets | Create; view, edit, assign, return, delete **own** assets; Excel import | Everything, all assets |
| Branches, asset types | Pick from the lists | Manage the lists |
| Users | View and edit self, change own password | List, view, edit, delete any user (not self-delete) |
| Software | View | View, add |
| Activity logs | — | View |
| Dashboard stats | Yes | Yes |

Ownership is taken from the token, never from the request body or headers. Assets created before this version only have a `createdBy` name; those still match their owner by name.

## Asset lifecycle

Every asset has a **status**:

| Status | Can move to |
|---|---|
| In stock | Assigned (assign), In repair, Retired |
| Assigned | Assigned (transfer), In stock (return), In repair, Retired |
| In repair | In stock, Retired |
| Retired | In stock, Disposed |
| Disposed | — (final; can't be edited) |

Status and the current holder (`user`) only change through the assign / return / status endpoints, never through a plain edit. Each period an asset spends with someone is stored as an **assignment** (who, branch, from, to, notes), so `GET /api/assets/:id/history` answers "who had this, where, and when".

## Branches and asset types

Admins manage the lists of branches (SOL ID + name) and asset types. Until at least one is added, free text is accepted as before. Once a list exists:

- new and edited assets must use a value from it (type matching ignores capitalisation and is saved in the list's spelling);
- choosing a branch fills in the asset's SOL ID and location;
- renaming a branch or type updates every asset that uses it;
- items in use can't be deleted, only deactivated.

`POST /api/branches/import-existing` and `POST /api/asset-types/import-existing` build the lists from the values already on your assets, so you don't have to type them in.

## Upgrading existing data

On startup the server:

- gives every asset without a status one: **Assigned** if it has a user (plus a history entry starting at its acquisition date), otherwise **In stock**;
- warns in the log about duplicate asset tags or serial numbers. Asset tags and serials must now be unique; the database can't enforce that until duplicates are fixed. Fix them, then restart.

Both steps are safe to run repeatedly.

## Excel import columns

`assetTag` (required), `serialNumber`, `assetType`, `model`, `solid`, `location`, `dateAcquired`, `user` (the person it's assigned to), `status` (optional; defaults to Assigned if `user` is set, otherwise In stock).

The whole sheet is checked before anything is saved; an error names the row.

## Endpoints

| Method | Path | Access |
|---|---|---|
| GET | `/api/health` | Public |
| POST | `/api/users/register` | Public |
| POST | `/api/users/login` | Public |
| GET | `/api/users/me` | Logged in |
| GET | `/api/users` | Admin |
| GET / PUT | `/api/users/:id` | Self or admin |
| DELETE | `/api/users/:id` | Admin |
| PUT | `/api/users/:id/change-password` | Self |
| GET | `/api/assets?search=&status=&assetType=&solid=&page=&limit=&sortBy=&order=` | Logged in (scoped, paginated) |
| POST | `/api/assets` | Logged in (optional `assignedTo` assigns on creation) |
| GET | `/api/assets/statuses` | Logged in |
| POST | `/api/assets/upload-excel` | Logged in (form field `excel`, .xlsx/.xls, max 5 MB, 5000 rows) |
| GET / PUT / DELETE | `/api/assets/:id` | Owner or admin |
| PUT | `/api/assets/admin/:id` | Admin |
| POST | `/api/assets/:id/assign` `{ assignedTo, solid?, notes? }` | Owner or admin (also transfers) |
| POST | `/api/assets/:id/return` `{ notes? }` | Owner or admin |
| POST | `/api/assets/:id/status` `{ status, notes? }` | Owner or admin |
| GET | `/api/assets/:id/history` | Owner or admin |
| GET | `/api/branches`, `/api/asset-types` | Logged in (`?all=true` for admins includes inactive + usage counts) |
| POST / PUT / DELETE | `/api/branches[/:id]`, `/api/asset-types[/:id]` | Admin |
| POST | `/api/branches/import-existing`, `/api/asset-types/import-existing` | Admin |
| GET | `/api/software` | Logged in |
| POST | `/api/software` | Admin |
| GET | `/api/logs?limit=500` | Admin |
| GET | `/api/stats` | Logged in |

All responses use `{ "status": "success" | "fail" | "error", "message"?, "data"? }`.

## Deploying (Render)

Set these environment variables in the Render dashboard: `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN` (your frontend URL), `NODE_ENV=production`.

Start command: `npm start`.
