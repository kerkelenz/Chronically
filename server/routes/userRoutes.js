const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { getTips, markTipsSeen, markTipIds, resetTipsSeen, getProfile, updateProfile, deleteAccount, updateAvatar, deleteAvatar, updateMilestones, markWelcomeSeen, updateNotificationPrefs, updateTimezone, searchWeatherLocation, clearWeatherLocation, updateTrackingMode } = require("../controllers/userController");

router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/avatar", authenticateToken, updateAvatar);
router.delete("/avatar", authenticateToken, deleteAvatar);
router.put("/milestones", authenticateToken, updateMilestones);
router.put("/welcome", authenticateToken, markWelcomeSeen);
router.get("/tips", authenticateToken, getTips);
router.put("/tips", authenticateToken, markTipIds);
// older app builds still mark a whole screen at once
router.put("/tips/:screen", authenticateToken, markTipsSeen);
router.delete("/tips", authenticateToken, resetTipsSeen);
router.put("/notification-prefs", authenticateToken, updateNotificationPrefs);
router.put("/timezone", authenticateToken, updateTimezone);
router.put("/tracking-mode", authenticateToken, updateTrackingMode);
router.post("/weather-location", authenticateToken, searchWeatherLocation);
router.delete("/weather-location", authenticateToken, clearWeatherLocation);
router.delete("/account", authenticateToken, deleteAccount);

module.exports = router;
