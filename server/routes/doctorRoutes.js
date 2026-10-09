const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getDoctors,
  saveDoctor,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorController");

router.get("/",       authenticateToken, getDoctors);
router.post("/",      authenticateToken, saveDoctor);
router.put("/:id",    authenticateToken, updateDoctor);
router.delete("/:id", authenticateToken, deleteDoctor);

module.exports = router;
