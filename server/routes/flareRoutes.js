const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getFlares,
  createFlare,
  updateFlare,
  deleteFlare,
} = require("../controllers/flareController");

router.get("/",       authenticateToken, getFlares);
router.post("/",      authenticateToken, createFlare);
router.put("/:id",    authenticateToken, updateFlare);
router.delete("/:id", authenticateToken, deleteFlare);

module.exports = router;
