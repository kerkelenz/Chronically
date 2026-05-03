const express = require("express");
// Router lets us define routes separately from server.js and then plug them in
// keeps things organized instead of putting every route directly in server.js
const router = express.Router();
// pulling in the register and login functions we wrote in authController
const { register, login } = require("../controllers/authController");

// when someone sends a POST to /api/auth/register it runs the register function
router.post("/register", register);

// same idea - POST to /api/auth/login runs the login function
router.post("/login", login);

module.exports = router;
