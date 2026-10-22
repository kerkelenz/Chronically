// Cleans up after sync({ alter: true }). Every boot with alter added another
// copy of each column-level unique constraint, so by October 2026 production
// had 430 identical unique indexes on Users.email, 434 on Users.username and
// 87 on PushTokens.token — every write to Users maintained ~865 indexes.
//
// For each set of identical unique indexes this keeps exactly one and drops
// the rest. It never touches a primary key, an index a foreign key relies on,
// or a unique index that has no twin. Also removes two enum types left behind
// when CheckIns' mood and pain moved to integers; DROP TYPE (no CASCADE)
// would fail rather than touch one that's still in use.
//
// Safe to run on a clean database: there is nothing to drop and it does nothing.

const FIND = `
  SELECT
    c.relname                          AS "table",
    ic.relname                         AS "index",
    con.conname                        AS "constraint",
    regexp_replace(pg_get_indexdef(i.indexrelid), 'INDEX \\S+ ON', 'INDEX ON') AS "shape",
    EXISTS (SELECT 1 FROM pg_constraint f WHERE f.contype = 'f' AND f.conindid = i.indexrelid) AS "referenced"
  FROM pg_index i
  JOIN pg_class c       ON c.oid  = i.indrelid
  JOIN pg_class ic      ON ic.oid = i.indexrelid
  JOIN pg_namespace n   ON n.oid  = c.relnamespace
  LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid AND con.contype = 'u'
  WHERE n.nspname = 'public' AND i.indisunique AND NOT i.indisprimary
`;

/** Which index of a set of twins to keep: one a foreign key relies on, else the plainest name. */
function pickKeeper(twins) {
  return [...twins].sort((a, b) =>
    (b.referenced - a.referenced) ||
    (/\d$/.test(a.index) - /\d$/.test(b.index)) ||
    (a.index.length - b.index.length) ||
    a.index.localeCompare(b.index),
  )[0];
}

const quote = (name) => `"${name.replace(/"/g, '""')}"`;

module.exports = {
  pickKeeper,

  async up({ context: { sequelize } }) {
    await sequelize.transaction(async (transaction) => {
      const [rows] = await sequelize.query(FIND, { transaction });
      const groups = new Map();
      for (const r of rows) {
        const key = r.shape;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      let dropped = 0;
      for (const twins of groups.values()) {
        if (twins.length < 2) continue;
        const keep = pickKeeper(twins);
        for (const r of twins) {
          if (r === keep || r.referenced) continue;
          await sequelize.query(
            r.constraint
              ? `ALTER TABLE ${quote(r.table)} DROP CONSTRAINT ${quote(r.constraint)}`
              : `DROP INDEX ${quote(r.index)}`,
            { transaction },
          );
          dropped += 1;
        }
      }
      await sequelize.query('DROP TYPE IF EXISTS "enum_CheckIns_moodLevel"', { transaction });
      await sequelize.query('DROP TYPE IF EXISTS "enum_CheckIns_painLevel"', { transaction });
      if (dropped) console.log(`  dropped ${dropped} duplicate unique index(es)`);
    });
  },

  // the duplicates were never wanted; there is nothing to put back
  async down() {},
};
