const { Sequelize } = require("sequelize");

// Sequelize needs to know how to talk to our database
// We're pulling the connection string from .env so we never hardcode secrets
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  // telling Sequelize we're using postgres specifically
  dialect: "postgres",
  dialectOptions: {
    // Supabase won't let us connect without SSL
    ssl: {
      require: true,
      // this allows the SSL cert to work in development without throwing errors
      rejectUnauthorized: false,
    },
  },
  // Sequelize logs every SQL query it runs which is really noisy - turning it off for now
  logging: false,
});

// this function actually tries to connect to the database when the server starts
const connectDB = async () => {
  try {
    // authenticate() just tests if the connection works, it doesn't do anything else
    await sequelize.authenticate();
    console.log("PostgreSQL connected successfully");
  } catch (error) {
    console.error("Database connection error:", error.message);
    // if we can't connect to the database there's no point running the server
    // process.exit(1) shuts everything down
    process.exit(1);
  }
};

// exporting both so server.js can run connectDB() on startup
// and our models can use the same sequelize instance to define tables
module.exports = { sequelize, connectDB };
