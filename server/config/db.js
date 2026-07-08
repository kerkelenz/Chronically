const { Sequelize } = require("sequelize");

// Sequelize needs to know how to talk to our database
// We're pulling the connection string from .env so we never hardcode secrets
// with rejectUnauthorized: false the connection is encrypted but the server's
// certificate is never checked, which leaves it open to man-in-the-middle attacks.
// set DB_CA_CERT to the Supabase CA certificate (Dashboard -> Settings -> Database
// -> SSL Configuration -> Download certificate, paste the PEM contents into the
// env var) to get full verification in production
const ssl = process.env.DB_CA_CERT
  ? { require: true, rejectUnauthorized: true, ca: process.env.DB_CA_CERT }
  : { require: true, rejectUnauthorized: false };

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  // telling Sequelize we're using postgres specifically
  dialect: "postgres",
  dialectOptions: {
    // Supabase won't let us connect without SSL
    ssl,
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
