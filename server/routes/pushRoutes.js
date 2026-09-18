const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { registerPushToken, unregisterPushToken } = require("../controllers/pushController");

router.post("/register", authenticateToken, registerPushToken);
router.delete("/register", authenticateToken, unregisterPushToken);

module.exports = router;
