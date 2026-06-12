const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Appointment = sequelize.define("Appointment", {
  userId:       { type: DataTypes.INTEGER, allowNull: false },
  doctorName:   { type: DataTypes.STRING, allowNull: false },
  specialty:    { type: DataTypes.STRING, allowNull: true },
  date:         { type: DataTypes.DATE, allowNull: false },
  location:     { type: DataTypes.STRING, allowNull: true },
  reason:       { type: DataTypes.STRING, allowNull: true },
  notesBefore:  { type: DataTypes.TEXT, allowNull: true },
  notesAfter:   { type: DataTypes.TEXT, allowNull: true },
  followUpDate: { type: DataTypes.DATE, allowNull: true },
  status:       { type: DataTypes.ENUM("upcoming", "completed", "cancelled"), defaultValue: "upcoming" },
});

User.hasMany(Appointment, { foreignKey: "userId", onDelete: "CASCADE" });
Appointment.belongsTo(User, { foreignKey: "userId" });

module.exports = Appointment;
