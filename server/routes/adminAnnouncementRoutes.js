const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcementController");

// every route here is authenticate-then-admin; there is no non-admin path in
router.get("/", authenticateToken, requireAdmin, listAnnouncements);
router.post("/", authenticateToken, requireAdmin, createAnnouncement);
router.put("/:id", authenticateToken, requireAdmin, updateAnnouncement);
router.delete("/:id", authenticateToken, requireAdmin, deleteAnnouncement);

module.exports = router;
