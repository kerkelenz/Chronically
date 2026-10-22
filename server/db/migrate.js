// Migration commands (run from server/):
//   npm run db:migrate              apply everything pending
//   npm run db:migrate:status       what's applied, what's pending
//   npm run db:migrate:down         undo the most recent one (local only)
//   npm run db:migration -- add-user-nickname
//                                   new, empty migration file to fill in
//
// It uses the same DATABASE_URL and the same safety rules as the server: a
// local machine can't migrate a remote database without ALLOW_REMOTE_DB=true.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { bootProblem, resolveStage } = require("../lib/environment");
const { MIGRATIONS_DIR } = require("./migrator");

const TEMPLATE = `// What this changes, and why.
module.exports = {
  async up({ context: { queryInterface, sequelize } }) {
    // e.g. await queryInterface.addColumn("Users", "nickname", { type: DataTypes.STRING, allowNull: true });
  },

  async down({ context: { queryInterface } }) {
    // e.g. await queryInterface.removeColumn("Users", "nickname");
  },
};
`;

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

async function main() {
  const [command = "up", ...rest] = process.argv.slice(2);

  if (command === "create") {
    const name = rest.join("-").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!name) throw new Error("Name the migration: npm run db:migration -- add-user-nickname");
    const file = path.join(MIGRATIONS_DIR, `${stamp()}-${name}.js`);
    fs.writeFileSync(file, TEMPLATE.replace("module.exports", 'const { DataTypes } = require("sequelize");\n\nmodule.exports'));
    console.log(`Created ${path.relative(process.cwd(), file)}`);
    return;
  }

  const problem = bootProblem({ JWT_SECRET: "not-needed-here", ...process.env });
  if (problem) throw new Error(`Refusing to run: ${problem}`);

  const { sequelize } = require("../config/db");
  const { createMigrator, migrateUp, withMigrationLock } = require("./migrator");
  try {
    if (command === "up") {
      const applied = await migrateUp(sequelize);
      console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Already up to date.");
    } else if (command === "status") {
      const m = createMigrator(sequelize, { logger: undefined });
      for (const x of await m.executed()) console.log(`  applied   ${x.name}`);
      for (const x of await m.pending()) console.log(`  pending   ${x.name}`);
    } else if (command === "down") {
      if (resolveStage(process.env) !== "local") throw new Error("Undoing migrations is for the local database only.");
      await withMigrationLock(sequelize, () => createMigrator(sequelize).down());
    } else {
      throw new Error(`Unknown command "${command}" (up, status, down, create <name>)`);
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}\n`);
  process.exitCode = 1;
});
