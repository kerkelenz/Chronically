// Builds the tables the models describe, from nothing, in DATABASE_URL.
// Only ever run by checkSchema.js, against its own throwaway database — the
// app itself changes its schema through migrations, never through sync().
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { databaseHost } = require("../lib/environment");

if (!/chronically_schema_check$/.test(new URL(process.env.DATABASE_URL).pathname)) {
  console.error(`syncModels only runs against the schema-check database, not ${databaseHost(process.env.DATABASE_URL)}`);
  process.exit(1);
}

const { sequelize } = require("../config/db");
const modelsDir = path.join(__dirname, "..", "models");
for (const f of fs.readdirSync(modelsDir)) require(path.join(modelsDir, f));

sequelize
  .sync()
  .then(() => sequelize.close())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
