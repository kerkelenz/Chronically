const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

// each row is one activity in the user's personal spoon-cost library
// users can add, edit, archive, or delete activities; the library persists across days
const SpoonActivity = sequelize.define("SpoonActivity", {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // the display name, e.g. "Shower" or "Cook a meal"
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // how many spoons this activity typically costs
  cost: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // optional emoji or icon key for display
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // pinned activities form the user's routine and auto-plan into an empty today
  pinned: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // soft-delete: archived activities don't show in the library but aren't destroyed
  // so existing day entries that reference the name still make sense historically
  archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

User.hasMany(SpoonActivity, { foreignKey: "userId", onDelete: "CASCADE" });
SpoonActivity.belongsTo(User, { foreignKey: "userId" });

module.exports = SpoonActivity;
