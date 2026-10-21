const { diffSchemas, indexShape, formatDiff } = require("./schemaDiff");

const snap = (over = {}) => ({
  columns: ["Users.email varchar NOT NULL"],
  indexes: ['CREATE UNIQUE INDEX ON public."Users" USING btree (email)'],
  enums: ["enum_Users_trackingMode physical,mental,both"],
  constraints: [],
  ...over,
});

describe("diffSchemas", () => {
  test("identical snapshots: nothing to report", () => {
    expect(diffSchemas(snap(), snap())).toEqual([]);
  });

  test("a column added to a model without a migration shows as only in models", () => {
    const models = snap({ columns: ["Users.email varchar NOT NULL", "Users.nickname varchar NULL"] });
    expect(diffSchemas(snap(), models)).toEqual([
      { kind: "columns", onlyIn: "models", item: "Users.nickname varchar NULL" },
    ]);
  });

  test("a migration the models don't reflect shows as only in migrations", () => {
    const migrated = snap({ enums: ["enum_Users_trackingMode physical,mental,both,other"] });
    const diff = diffSchemas(migrated, snap());
    expect(diff).toEqual([
      { kind: "enums", onlyIn: "models", item: "enum_Users_trackingMode physical,mental,both" },
      { kind: "enums", onlyIn: "migrations", item: "enum_Users_trackingMode physical,mental,both,other" },
    ]);
  });

  test("missing kinds count as empty", () => {
    expect(diffSchemas({ columns: ["a"] }, { columns: ["a"] })).toEqual([]);
  });
});

describe("indexShape", () => {
  test("the index's own name is dropped, quoted or not", () => {
    expect(indexShape('CREATE UNIQUE INDEX "Users_email_key12" ON public."Users" USING btree (email)'))
      .toBe('CREATE UNIQUE INDEX ON public."Users" USING btree (email)');
    expect(indexShape("CREATE INDEX users_x ON public.\"Users\" USING btree (x)"))
      .toBe('CREATE INDEX ON public."Users" USING btree (x)');
  });
});

describe("formatDiff", () => {
  test("one readable line per difference", () => {
    const text = formatDiff([{ kind: "columns", onlyIn: "models", item: "Users.nickname varchar NULL" }]);
    expect(text).toMatch(/columns\s+only in models\s+Users\.nickname/);
  });
});
