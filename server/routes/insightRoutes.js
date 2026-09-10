const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { getInsights } = require("../controllers/insightController");

router.get("/", authenticateToken, getInsights);

module.exports = router;
