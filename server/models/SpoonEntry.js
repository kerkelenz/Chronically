const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const SpoonDay = require("./SpoonDay");

// one row per activity placed on a specific day's plan
// name and cost are snapshotted at creation time so later edits to the library
// don't silently rewrite past or in-progress day plans
const SpoonEntry = sequelize.define("SpoonEntry", {
  spoonDayId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // snapshotted from the activity library at the time the entry is added
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cost: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // toggled as the user works through their day
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // display order within the day
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

// cascade from the day: deleting a SpoonDay wipes all its entries
SpoonDay.hasMany(SpoonEntry, { foreignKey: "spoonDayId", onDelete: "CASCADE" });
SpoonEntry.belongsTo(SpoonDay, { foreignKey: "spoonDayId" });

// cascade from the user: deleting a user wipes all their entries
User.hasMany(SpoonEntry, { foreignKey: "userId", onDelete: "CASCADE" });
SpoonEntry.belongsTo(User, { foreignKey: "userId" });

module.exports = SpoonEntry;
