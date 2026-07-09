const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { ingestEvents } = require("../controllers/eventController");

router.post("/", authenticateToken, ingestEvents);

module.exports = router;
