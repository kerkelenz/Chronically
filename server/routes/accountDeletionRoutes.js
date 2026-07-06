const express = require("express");
const router = express.Router();
const { requestAccountDeletion } = require("../controllers/accountDeletionController");

// public — no auth (users requesting deletion may no longer be able to sign in)
router.post("/", requestAccountDeletion);

module.exports = router;
