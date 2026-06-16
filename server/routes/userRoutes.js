const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { updateProfile, deleteAccount, updateAvatar, deleteAvatar, updateMilestones } = require("../controllers/userController");

router.put("/profile", authenticateToken, updateProfile);
router.put("/avatar", authenticateToken, updateAvatar);
router.delete("/avatar", authenticateToken, deleteAvatar);
router.put("/milestones", authenticateToken, updateMilestones);
router.delete("/account", authenticateToken, deleteAccount);

module.exports = router;
