const express = require("express");
const router = express.Router();
const Log = require("../model/Log.model");

router.get("/", async (req, res) => {
  try {
    const logs = await Log.find().sort({ createdAt: -1 });
    res.status(200).json({ data: logs });
  } catch (err) {
    res.status(500).json({ message: "Error fetching logs" });
  }
});

module.exports = router;
