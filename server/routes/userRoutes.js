const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { updateProfile, deleteAccount } = require("../controllers/userController");

router.put("/profile", authenticateToken, updateProfile);
router.delete("/account", authenticateToken, deleteAccount);

module.exports = router;
