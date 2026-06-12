const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Medication = sequelize.define("Medication", {
  userId:         { type: DataTypes.INTEGER, allowNull: false },
  name:           { type: DataTypes.STRING, allowNull: false },
  type:           { type: DataTypes.ENUM("pill", "injection", "infusion", "supplement"), allowNull: false },
  dosage:         { type: DataTypes.STRING, allowNull: true },
  frequency:      { type: DataTypes.ENUM("daily", "twice_daily", "three_times_daily", "four_times_daily", "every_other_day", "weekly", "biweekly", "monthly", "every_x_weeks", "as_needed"), allowNull: false },
  frequencyWeeks: { type: DataTypes.INTEGER, allowNull: true },
  scheduledTimes: { type: DataTypes.JSON, allowNull: true },
  notes:          { type: DataTypes.TEXT, allowNull: true },
  active:         { type: DataTypes.BOOLEAN, defaultValue: true },
});

User.hasMany(Medication, { foreignKey: "userId", onDelete: "CASCADE" });
Medication.belongsTo(User, { foreignKey: "userId" });

module.exports = Medication;
