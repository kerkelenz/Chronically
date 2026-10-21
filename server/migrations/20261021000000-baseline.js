// The starting point: every table as it stood when migrations were adopted.
//
// On a database that already has the schema (staging copied from production,
// or production itself) this does nothing but get recorded. On an empty one
// (the Docker database, CI) it creates everything from the snapshot in sql/.
const fs = require("fs");
const path = require("path");

const SQL = path.join(__dirname, "sql", "20261021000000-baseline.sql");

module.exports = {
  async up({ context: { queryInterface, sequelize } }) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Users")) return; // already there: adopt it as-is
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(fs.readFileSync(SQL, "utf8"), { transaction });
    });
  },

  async down() {
    throw new Error("The baseline can't be undone. Drop the database instead (npm run db:reset).");
  },
};
