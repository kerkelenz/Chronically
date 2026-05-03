require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { connectDB, sequelize } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
require("./models/User");
require("./models/CheckIn");

const app = express();

const startServer = async () => {
  await connectDB();
  await sequelize.sync({ alter: true });
  console.log("Database synced");

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRoutes);

  app.get("/api/test", (req, res) => {
    res.json({ message: "Chronically backend is working!" });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
