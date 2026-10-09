const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

// one row per user per calendar date - represents their planned spoon budget for that day
// the budget is auto-computed from their baseline + that day's check-in, unless they edit it
const SpoonDay = sequelize.define(
  "SpoonDay",
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    // how many spoons the user has to spend today
    budget: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // once the user manually edits their budget we stop auto-recomputing it
    // so a check-in logged after they've already adjusted it doesn't override their choice
    budgetEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // How the day actually went, in the user's own words rather than a score.
    // Null means they did not say -- never "about right" by default, never
    // counted, and never read by the insight engine (insightController.js
    // selects an explicit column list, which is what keeps it out).
    reflection: {
      type: DataTypes.ENUM("lighter", "about_right", "heavier"),
      allowNull: true,
    },
    // Optional free text, at most 280 characters, and only ever present when a
    // reflection is: a note with nothing to attach itself to would be orphaned.
    reflectionNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    // a user can only have one SpoonDay row per date
    indexes: [{ unique: true, fields: ["userId", "date"] }],
  },
);

User.hasMany(SpoonDay, { foreignKey: "userId", onDelete: "CASCADE" });
SpoonDay.belongsTo(User, { foreignKey: "userId" });

module.exports = SpoonDay;
