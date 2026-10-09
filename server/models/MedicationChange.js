const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const Medication = require("./Medication");

// What a medication's dosage and schedule used to be. Append-only: there are no
// update or delete routes, because a history somebody can edit is not a history.
//
// Deliberately NOT backfilled. Existing medications have no record of what they
// looked like when they were added, and writing a "created" row with today's
// values would claim knowledge we don't have. The history endpoint instead
// derives an "Added" entry from the medication's own createdAt, with no field
// values attached, and never saves it.
//
// `changes` holds [{ field, from, to }] over the *canonical* projection of the
// schedule (see lib/medHistory.js), not the raw columns. Both edit forms always
// send the canonical shape, so a legacy row like frequency "weekly" is rewritten
// to "specific_days" the first time anyone opens and saves it — a raw column
// diff would record that as a change the user never made.
const MedicationChange = sequelize.define("MedicationChange", {
  userId:       { type: DataTypes.INTEGER, allowNull: false },
  medicationId: { type: DataTypes.INTEGER, allowNull: false },
  changedAt:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  kind: {
    type: DataTypes.ENUM("created", "changed", "deactivated", "reactivated"),
    allowNull: false,
  },
  changes:      { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
}, {
  indexes: [{ fields: ["medicationId", "changedAt"] }],
});

User.hasMany(MedicationChange, { foreignKey: "userId", onDelete: "CASCADE" });
MedicationChange.belongsTo(User, { foreignKey: "userId" });
// deleting a medication takes its history with it, as it already takes its logs
Medication.hasMany(MedicationChange, { foreignKey: "medicationId", onDelete: "CASCADE" });
MedicationChange.belongsTo(Medication, { foreignKey: "medicationId" });

module.exports = MedicationChange;
