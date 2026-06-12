const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getMedications, createMedication, updateMedication, deleteMedication,
  getLogs, createLog, updateLog, deleteMedicationLog,
} = require("../controllers/medicationController");

// /logs routes must be defined before /:id so Express doesn't treat "logs" as an id param
router.get("/logs", authenticateToken, getLogs);
router.post("/logs", authenticateToken, createLog);
router.put("/logs/:id", authenticateToken, updateLog);
router.delete("/logs/:id", authenticateToken, deleteMedicationLog);

router.get("/", authenticateToken, getMedications);
router.post("/", authenticateToken, createMedication);
router.put("/:id", authenticateToken, updateMedication);
router.delete("/:id", authenticateToken, deleteMedication);

module.exports = router;
