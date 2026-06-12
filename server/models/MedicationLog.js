const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const Medication = require("./Medication");

const MedicationLog = sequelize.define("MedicationLog", {
  userId:        { type: DataTypes.INTEGER, allowNull: false },
  medicationId:  { type: DataTypes.INTEGER, allowNull: false },
  date:          { type: DataTypes.DATEONLY, allowNull: false },
  scheduledTime: { type: DataTypes.STRING, allowNull: true },
  takenAt:       { type: DataTypes.DATE, allowNull: true },
  status:        { type: DataTypes.ENUM("taken", "skipped", "missed"), allowNull: false },
  skipReason:    { type: DataTypes.STRING, allowNull: true },
});

User.hasMany(MedicationLog, { foreignKey: "userId", onDelete: "CASCADE" });
MedicationLog.belongsTo(User, { foreignKey: "userId" });
Medication.hasMany(MedicationLog, { foreignKey: "medicationId", onDelete: "CASCADE" });
MedicationLog.belongsTo(Medication, { foreignKey: "medicationId" });

module.exports = MedicationLog;
