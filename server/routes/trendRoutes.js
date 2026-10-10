const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { getTrendSummary } = require("../controllers/trendController");

router.get("/summary", authenticateToken, getTrendSummary);

module.exports = router;
