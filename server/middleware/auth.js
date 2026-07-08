const jwt = require("jsonwebtoken");
const User = require("../models/User");

// this middleware runs before any protected route
// its job is to check if the request has a valid token before letting it through
const authenticateToken = async (req, res, next) => {
  try {
    // the token comes in the Authorization header formatted as "Bearer tokengoeshere"
    const authHeader = req.headers["authorization"];

    // we split on the space and grab the second part - index 0 is "Bearer", index 1 is the token
    const token = authHeader && authHeader.split(" ")[1];

    // if there's no token at all, stop here and send back a 401
    // the request never reaches the actual route
    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    // jwt.verify checks that the token is valid and hasn't expired
    // it uses our JWT_SECRET to verify the signature - if someone tampered with the token this will fail
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // tokens live 30 days, so also confirm the account still exists - otherwise
    // a token for a deleted account would reach routes that expect a real user
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    // attach the user info to req.user so any route can access who's logged in
    // username comes from the database rather than the token so it never goes stale
    req.user = { id: user.id, username: user.username };

    // everything checks out - pass the request along to the actual route handler
    next();
  } catch (error) {
    // jwt.verify throws an error if the token is invalid or expired
    // we catch it here and send back a 401 instead of crashing
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    // anything else (like a database hiccup during the user lookup) is a server
    // problem, not a bad token - a 401 here would wrongly sign the user out
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = authenticateToken;
