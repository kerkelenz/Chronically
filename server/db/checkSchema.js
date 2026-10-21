// Does the migrated database match the models? (npm run db:check)
//
// Builds a throwaway database straight from the models, snapshots both, and
// fails with a list of differences if they disagree — which means a model
// changed without a migration, or a migration did something the models don't
// describe. CI runs this on every push, against a freshly migrated database.
//
// Needs a role allowed to CREATE DATABASE (the Docker and CI ones are).
// Local only, unless ALLOW_REMOTE_DB=true.
require("dotenv").config();
const { execFileSync } = require("child_process");
const path = require("path");
const { Sequelize } = require("sequelize");
const { bootProblem, sslOptions } = require("../lib/environment");
const { diffSchemas, indexShape, formatDiff } = require("../lib/schemaDiff");

const SCRATCH = "chronically_schema_check";

function connect(url) {
  const ssl = sslOptions({ ...process.env, DATABASE_URL: url });
  return new Sequelize(url, { dialect: "postgres", logging: false, dialectOptions: ssl ? { ssl } : {} });
}

async function snapshot(sequelize) {
  const q = async (sql) => (await sequelize.query(sql))[0];
  const columns = await q(`
    SELECT table_name || '.' || column_name || ' ' || udt_name || ' ' ||
           CASE WHEN is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END ||
           COALESCE(' DEFAULT ' || column_default, '') AS d
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> 'SchemaMigrations'`);
  const indexes = await q(`
    SELECT indexdef AS d FROM pg_indexes
    WHERE schemaname = 'public' AND tablename <> 'SchemaMigrations'`);
  const enums = await q(`
    SELECT t.typname || ' ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS d
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' GROUP BY t.typname`);
  const constraints = await q(`
    SELECT conrelid::regclass::text || ' ' || pg_get_constraintdef(oid) AS d
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace AND contype IN ('f', 'c', 'p', 'u')
      AND conrelid::regclass::text <> '"SchemaMigrations"'`);
  return {
    columns: columns.map((r) => r.d),
    indexes: indexes.map((r) => indexShape(r.d)),
    enums: enums.map((r) => r.d),
    constraints: constraints.map((r) => r.d),
  };
}

async function main() {
  const problem = bootProblem({ JWT_SECRET: "not-needed-here", ...process.env });
  if (problem) throw new Error(`Refusing to run: ${problem}`);

  const url = new URL(process.env.DATABASE_URL);
  const scratchUrl = new URL(url);
  scratchUrl.pathname = `/${SCRATCH}`;

  const db = connect(url.toString());
  try {
    await db.query(`DROP DATABASE IF EXISTS ${SCRATCH}`);
    await db.query(`CREATE DATABASE ${SCRATCH}`);

    // the models build their own tables in a child process pointed at the scratch database
    execFileSync(process.execPath, [path.join(__dirname, "syncModels.js")], {
      env: { ...process.env, DATABASE_URL: scratchUrl.toString() },
      stdio: "inherit",
    });

    const scratch = connect(scratchUrl.toString());
    const [migrated, models] = [await snapshot(db), await snapshot(scratch)];
    await scratch.close();

    const diff = diffSchemas(migrated, models);
    if (diff.length) {
      console.error(`\n✖ The migrated schema and the models disagree:\n${formatDiff(diff)}\n`);
      console.error("  Add a migration for the model change (npm run db:migration -- <name>).\n");
      process.exitCode = 1;
    } else {
      console.log(`✔ Migrations match the models (${migrated.columns.length} columns, ${migrated.indexes.length} indexes).`);
    }
  } finally {
    await db.query(`DROP DATABASE IF EXISTS ${SCRATCH}`).catch(() => {});
    await db.close();
  }
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}\n`);
  process.exitCode = 1;
});
