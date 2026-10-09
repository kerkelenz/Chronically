const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

// A stretch of days the user chose to label a flare. Dates, not times: a flare
// is a run of calendar days, inclusive at both ends, and `endDate: null` means
// it is still going.
//
// The app never infers one of these. Nothing here is derived from check-in
// scores, from symptoms, or from the unrelated "Pain flare" symptom tag — only
// the user starts a flare and only the user ends it.
const Flare = sequelize.define("Flare", {
  userId:    { type: DataTypes.INTEGER, allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  // null = ongoing. Not a sentinel date: "still happening" is genuinely the
  // absence of an end, and a far-future placeholder would start showing up in
  // range queries as a real value.
  endDate:   { type: DataTypes.DATEONLY, allowNull: true },
  note:      { type: DataTypes.STRING(280), allowNull: true },
}, {
  indexes: [
    // the list and the wave-2 range query both read per user, newest first
    { fields: ["userId", "startDate"] },
    // "one ongoing flare per user", enforced where a race cannot get around it.
    // It has to be PARTIAL: Postgres treats NULLs as distinct, so a plain
    // unique index on (userId, endDate) would happily accept a second row with
    // endDate NULL and enforce nothing at all.
    {
      unique: true,
      fields: ["userId"],
      where: { endDate: null },
      name: "flares_one_ongoing_per_user",
    },
  ],
});

User.hasMany(Flare, { foreignKey: "userId", onDelete: "CASCADE" });
Flare.belongsTo(User, { foreignKey: "userId" });

module.exports = Flare;
