// dotenv has to be first so all the environment variables are loaded before anything else runs
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { connectDB, sequelize } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const checkInRoutes = require("./routes/checkInRoutes");
const authenticateToken = require("./middleware/auth");
// importing the models here so Sequelize knows about them before we call sync
// if we don't import them they won't get created in the database
require("./models/User");
require("./models/CheckIn");

// creating the express app - everything gets attached to this
const app = express();

// wrapping everything in an async function so we can use await for the database connection
// we want to make sure the database is ready before the server starts accepting requests
const startServer = async () => {
  await connectDB();

  // sync tells Sequelize to look at our models and make sure the database tables match
  // alter: true updates existing tables if we've made changes to our models
  // we wouldn't use alter: true in production but it's handy during development
  await sequelize.sync({ alter: true });
  console.log("Database synced");

  // helmet automatically sets a bunch of security headers on every response
  app.use(helmet());
  // cors allows our React frontend on localhost:5173 to talk to this backend on localhost:3001
  // without this the browser would block the requests
  app.use(cors());
  // this lets us read JSON from the request body - without it req.body would be undefined
  app.use(express.json());

  // all auth routes live under /api/auth
  // so /register becomes /api/auth/register and /login becomes /api/auth/login
  app.use("/api/auth", authRoutes);

  app.use("/api/checkins", checkInRoutes);

  // simple test route to confirm the server is running
  app.get("/api/test", (req, res) => {
    res.json({ message: "Chronically backend is working!" });
  });

  // this is just a test route to make sure the middleware is working correctly
  // authenticateToken sits between the route path and the handler function
  // it runs first, and only calls next() if the token is valid
  // req.user is available here because authenticateToken attached it after verifying the token
  app.get("/api/protected", authenticateToken, (req, res) => {
    res.json({ message: `Hello ${req.user.username}, you are authenticated!` });
  });

  // use the PORT from .env if it exists, otherwise default to 3001
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
