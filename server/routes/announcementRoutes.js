const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getCurrentAnnouncement,
  dismissAnnouncement,
} = require("../controllers/announcementController");

router.get("/", authenticateToken, getCurrentAnnouncement);
router.post("/:id/dismiss", authenticateToken, dismissAnnouncement);

module.exports = router;
