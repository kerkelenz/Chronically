const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} = require("../controllers/appointmentController");

router.get("/",    authenticateToken, getAppointments);
router.post("/",   authenticateToken, createAppointment);
router.put("/:id", authenticateToken, updateAppointment);
router.delete("/:id", authenticateToken, deleteAppointment);

module.exports = router;
