const { Sequelize } = require("sequelize");
const { sslOptions } = require("../lib/environment");

// One connection string per stage (see lib/environment.js): the Docker Postgres
// locally, the staging Supabase on `develop`, the production Supabase on `main`.
// SSL is on for any remote database and off for the local one. Without
// DB_CA_CERT the connection is encrypted but the certificate isn't checked —
// set it to the Supabase CA (Dashboard -> Settings -> Database -> SSL
// Configuration) for full verification.
const ssl = sslOptions(process.env);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: ssl ? { ssl } : {},
  // Sequelize logs every SQL query it runs which is really noisy
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
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
