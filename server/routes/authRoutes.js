const express = require("express");
// Router lets us define routes separately from server.js and then plug them in
// keeps things organized instead of putting every route directly in server.js
const router = express.Router();
// pulling in the register and login functions we wrote in authController
const { register, login, verifyEmail, forgotPassword, resetPassword } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
