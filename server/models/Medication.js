const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Medication = sequelize.define("Medication", {
  userId:         { type: DataTypes.INTEGER, allowNull: false },
  name:           { type: DataTypes.STRING, allowNull: false },
  type:           { type: DataTypes.ENUM("pill", "injection", "infusion", "supplement"), allowNull: false },
  dosage:         { type: DataTypes.STRING, allowNull: true },
  // legacy values (twice_daily, weekly, biweekly, every_other_day, every_x_weeks)
  // stay accepted forever - the shared schedule helper maps them to the five
  // canonical patterns (daily, specific_days, every_n_days, monthly, as_needed)
  frequency:      { type: DataTypes.ENUM("daily", "twice_daily", "three_times_daily", "four_times_daily", "every_other_day", "weekly", "biweekly", "monthly", "every_x_weeks", "as_needed", "specific_days", "every_n_days"), allowNull: false },
  frequencyWeeks: { type: DataTypes.INTEGER, allowNull: true },
  scheduledTimes: { type: DataTypes.JSON, allowNull: true },
  daysOfWeek:     { type: DataTypes.JSON, allowNull: true },      // [0=Sun … 6=Sat]
  startDate:      { type: DataTypes.DATEONLY, allowNull: true },  // anchor for every_n_days / monthly
  intervalDays:   { type: DataTypes.INTEGER, allowNull: true },   // for every_n_days
  notes:          { type: DataTypes.TEXT, allowNull: true },
  active:         { type: DataTypes.BOOLEAN, defaultValue: true },
});

User.hasMany(Medication, { foreignKey: "userId", onDelete: "CASCADE" });
Medication.belongsTo(User, { foreignKey: "userId" });

module.exports = Medication;
