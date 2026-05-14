const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { updateProfile } = require("../controllers/userController");

router.put("/profile", authenticateToken, updateProfile);

module.exports = router;
