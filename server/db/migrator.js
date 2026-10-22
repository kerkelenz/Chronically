// Schema migrations, run in order and recorded in the "SchemaMigrations" table.
//
// Every schema change is a file in server/migrations/, named
// YYYYMMDDHHMMSS-what-it-does.js, exporting `up` (and `down` where it can be
// undone). They run at boot on every stage — local, staging, production — so a
// change reaches staging, and gets tried there, before it ever reaches users.
//
// Only one process may migrate at a time: a Postgres advisory lock, held on a
// connection of its own, makes a second booting instance wait its turn.
const path = require("path");
const { Umzug, SequelizeStorage } = require("umzug");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const LOCK_KEY = 4815162342; // any constant; just has to be the same everywhere

function createMigrator(sequelize, { logger = console } = {}) {
  return new Umzug({
    migrations: { glob: ["*.js", { cwd: MIGRATIONS_DIR }] },
    context: { queryInterface: sequelize.getQueryInterface(), sequelize },
    storage: new SequelizeStorage({ sequelize, tableName: "SchemaMigrations" }),
    logger,
  });
}

/** Runs `fn` while holding the migration lock. */
async function withMigrationLock(sequelize, fn) {
  const conn = await sequelize.connectionManager.getConnection();
  try {
    await conn.query(`SELECT pg_advisory_lock(${LOCK_KEY})`);
    try {
      return await fn();
    } finally {
      await conn.query(`SELECT pg_advisory_unlock(${LOCK_KEY})`);
    }
  } finally {
    sequelize.connectionManager.releaseConnection(conn);
  }
}

/** Applies every pending migration; returns their names. */
async function migrateUp(sequelize, opts) {
  return withMigrationLock(sequelize, async () => {
    const applied = await createMigrator(sequelize, opts).up();
    return applied.map((m) => m.name);
  });
}

module.exports = { createMigrator, migrateUp, withMigrationLock, MIGRATIONS_DIR };
