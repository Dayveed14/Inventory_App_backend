// Creates an admin account, or promotes an existing account to admin.
//
// Sign-up always creates regular users, so this is how the first admin is made.
//
// Usage:
//   npm run create-admin -- <email> [password] [name]
//
// - If the email already exists, that user is promoted to admin (password unchanged).
// - Otherwise a new admin is created; password and name are then required.

// Same DNS workaround as app.js, for MongoDB Atlas SRV lookups.
require("node:dns").setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const { connectDB } = require("../config/db");
const User = require("../model/User.model");

async function main() {
  const [emailArg, password, ...nameParts] = process.argv.slice(2);

  if (!emailArg) {
    console.error("Usage: npm run create-admin -- <email> [password] [name]");
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();

  await connectDB();

  const existing = await User.findOne({ email });

  if (existing) {
    existing.role = "admin";
    await existing.save();
    console.log(`Promoted ${email} to admin.`);
    return;
  }

  const name = nameParts.join(" ").trim();

  if (!password || password.length < 8 || !name) {
    console.error(
      "No user with that email exists. To create one, give a password (8+ characters) and a name:\n" +
        "  npm run create-admin -- admin@example.com 'StrongPass123' 'Jane Admin'"
    );
    process.exitCode = 1;
    return;
  }

  await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: "admin",
  });

  console.log(`Created admin ${email}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
