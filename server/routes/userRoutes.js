const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { getProfile, updateProfile, deleteAccount, updateAvatar, deleteAvatar, updateMilestones, markWelcomeSeen } = require("../controllers/userController");

router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/avatar", authenticateToken, updateAvatar);
router.delete("/avatar", authenticateToken, deleteAvatar);
router.put("/milestones", authenticateToken, updateMilestones);
router.put("/welcome", authenticateToken, markWelcomeSeen);
router.delete("/account", authenticateToken, deleteAccount);

module.exports = router;
