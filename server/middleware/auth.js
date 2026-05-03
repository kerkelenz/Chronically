const jwt = require("jsonwebtoken");

// this middleware runs before any protected route
// its job is to check if the request has a valid token before letting it through
const authenticateToken = (req, res, next) => {
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

    // attach the decoded user info to req.user so any route can access who's logged in
    // decoded contains the id and username we put in the token when we created it
    req.user = decoded;

    // everything checks out - pass the request along to the actual route handler
    next();
  } catch (error) {
    // jwt.verify throws an error if the token is invalid or expired
    // we catch it here and send back a 401 instead of crashing
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

module.exports = authenticateToken;
