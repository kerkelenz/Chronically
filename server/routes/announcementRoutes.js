const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getCurrentAnnouncement,
  getAnnouncementHistory,
  dismissAnnouncement,
} = require("../controllers/announcementController");

router.get("/", authenticateToken, getCurrentAnnouncement);
// must precede any /:id route, or "history" is swallowed as an id
router.get("/history", authenticateToken, getAnnouncementHistory);
router.post("/:id/dismiss", authenticateToken, dismissAnnouncement);

module.exports = router;
