const User = require("../models/User");

// requireAdmin runs after authenticateToken and gates the admin endpoints.
//
// authenticateToken already loads the user row on every request and copies
// `isAdmin` off it, so req.user.isAdmin is database truth rather than anything
// the client supplied. The re-read below is a deliberate belt-and-braces: if
// this middleware is ever mounted without authenticateToken in front of it, or
// that middleware's shape changes, it fails closed instead of waving a request
// through on a missing property.
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    const user = await User.findByPk(req.user.id, { attributes: ["id", "isAdmin"] });
    if (!user || user.isAdmin !== true) {
      // deliberately the same message either way — no hint that the route exists
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Require admin error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = requireAdmin;
