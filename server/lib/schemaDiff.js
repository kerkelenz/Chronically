// Compares two schema snapshots: what the migrations built, and what the
// models describe. Any difference means a model changed without a migration
// (or the other way round). Pure — the snapshots are plain arrays of strings.
//
// A snapshot is { columns, indexes, enums, constraints }, each a list of
// one-line descriptions. Index and constraint names are left out: two
// identical indexes are the same index whatever they're called.

const KINDS = ["columns", "indexes", "enums", "constraints"];

/** → [{ kind, onlyIn: "migrations"|"models", item }], sorted; empty when they match. */
function diffSchemas(migrated, models) {
  const out = [];
  for (const kind of KINDS) {
    const a = new Set(migrated[kind] || []);
    const b = new Set(models[kind] || []);
    for (const item of a) if (!b.has(item)) out.push({ kind, onlyIn: "migrations", item });
    for (const item of b) if (!a.has(item)) out.push({ kind, onlyIn: "models", item });
  }
  return out.sort((x, y) => x.kind.localeCompare(y.kind) || x.item.localeCompare(y.item) || x.onlyIn.localeCompare(y.onlyIn));
}

/** Drops an index's own name from its definition, so twins compare equal. */
function indexShape(indexdef) {
  return indexdef.replace(/INDEX\s+("[^"]+"|\S+)\s+ON/i, "INDEX ON");
}

function formatDiff(diff) {
  return diff.map((d) => `  ${d.kind.padEnd(11)} only in ${d.onlyIn.padEnd(10)} ${d.item}`).join("\n");
}

module.exports = { diffSchemas, indexShape, formatDiff };
