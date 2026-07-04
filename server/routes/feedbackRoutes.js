const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { submitFeedback } = require("../controllers/feedbackController");

router.post("/", authenticateToken, submitFeedback);

module.exports = router;
