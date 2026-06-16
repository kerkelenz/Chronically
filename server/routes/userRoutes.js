const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { updateProfile, deleteAccount, updateAvatar, deleteAvatar } = require("../controllers/userController");

router.put("/profile", authenticateToken, updateProfile);
router.put("/avatar", authenticateToken, updateAvatar);
router.delete("/avatar", authenticateToken, deleteAvatar);
router.delete("/account", authenticateToken, deleteAccount);

module.exports = router;
