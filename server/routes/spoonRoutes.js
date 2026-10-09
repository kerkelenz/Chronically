const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getBaseline,
  setBaseline,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  getDay,
  getMonth,
  getWeek,
  updateDayReflection,
  updateDayBudget,
  addEntry,
  updateEntry,
  deleteEntry,
} = require("../controllers/spoonController");

// static segments first so they don't get matched as /:id params
router.get("/baseline", authenticateToken, getBaseline);
router.put("/baseline", authenticateToken, setBaseline);

router.get("/activities", authenticateToken, getActivities);
router.post("/activities", authenticateToken, createActivity);
router.put("/activities/:id", authenticateToken, updateActivity);
router.delete("/activities/:id", authenticateToken, deleteActivity);

router.get("/day", authenticateToken, getDay);
router.get("/month", authenticateToken, getMonth);
router.get("/week", authenticateToken, getWeek);
router.put("/day/:id", authenticateToken, updateDayBudget);
router.put("/day/:id/reflection", authenticateToken, updateDayReflection);
router.post("/day/:id/entries", authenticateToken, addEntry);

router.put("/entries/:id", authenticateToken, updateEntry);
router.delete("/entries/:id", authenticateToken, deleteEntry);

module.exports = router;
