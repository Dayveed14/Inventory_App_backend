const express = require("express");
const router = express.Router();
const Software = require("../model/Software.model");

// POST /api/software - Add new software
router.post("/", async (req, res) => {
  try {
    const software = new Software(req.body);
    await software.save();
    res.status(201).json({ message: "Software added successfully", software });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add software" });
  }
});

// GET /api/software - Get all software
router.get("/", async (req, res) => {
  try {
    const allSoftware = await Software.find();
    res.status(200).json(allSoftware);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve software list" });
  }
});

module.exports = router;
