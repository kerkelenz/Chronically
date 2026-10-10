const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getMedications, createMedication, updateMedication, deleteMedication, refillMedication,
  getMedicationHistory, getMedicationChanges,
  getLogs, createLog, updateLog, deleteMedicationLog,
} = require("../controllers/medicationController");

// /logs routes must be defined before /:id so Express doesn't treat "logs" as an id param
router.get("/logs", authenticateToken, getLogs);
router.post("/logs", authenticateToken, createLog);
router.put("/logs/:id", authenticateToken, updateLog);
router.delete("/logs/:id", authenticateToken, deleteMedicationLog);

// every medication's history in a range (Trends markers) — before /:id too
router.get("/changes", authenticateToken, getMedicationChanges);

// after /logs, before /:id — a refill is a write on one medication
router.post("/:id/refill", authenticateToken, refillMedication);
router.get("/:id/history", authenticateToken, getMedicationHistory);

router.get("/", authenticateToken, getMedications);
router.post("/", authenticateToken, createMedication);
router.put("/:id", authenticateToken, updateMedication);
router.delete("/:id", authenticateToken, deleteMedication);

module.exports = router;
