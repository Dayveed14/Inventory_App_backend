const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const userApi = require("./routes/User.route");
const assetRoutes = require("./routes/Asset.route");
const logRoutes = require("./routes/Log.route");
const softwareRoutes = require("./routes/Software.route");
const PORT = 4000;
const app = express();

// Serve static files from the "uploads" folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

mongoose
  .connect(
    "mongodb+srv://Dayveed:Upt0wnk!nq@cluster0.pzicq0x.mongodb.net/inventory_db"
  )
  .then(() => {
    console.log("Connection successful");
  })
  .catch((err) => console.log(err));

app.use("/api/users", userApi);
app.use("/api/assets", assetRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/software", softwareRoutes);

app.listen(PORT, () => {
  console.log(`Server running on Port: ${PORT}`);
});
