const authenticateToken = require("../middleware/auth");
const express = require("express");
const router = express.Router();
const {
  createCheckIn,
  getCheckIns,
  updateCheckIn,
  deleteCheckIn,
} = require("../controllers/checkInController");

// run the authentication middleware and create check-in
// for the logged in user
router.post("/", authenticateToken, createCheckIn);

// runs the authentication middleware and retrieves check-instead
// for the logged in user
router.get("/", authenticateToken, getCheckIns);

// runs authentication middleware and updates a specific check-in by id
router.put("/:id", authenticateToken, updateCheckIn);

// runs authentication middleware and deletes a specific check-in by id
router.delete("/:id", authenticateToken, deleteCheckIn);

module.exports = router;
