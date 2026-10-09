const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
// importing User here because we need to define the relationship between the two models
const User = require("./User");

// defining the CheckIn table - this is what gets stored every time someone does a daily check-in
const CheckIn = sequelize.define("CheckIn", {
  // Optional, exactly like sleepLevel: someone with no physical pain should
  // never be made to rate it. null means "not asked or skipped" — never a
  // fake zero, and never counted in an average.
  painLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5,
    },
  },
  moodLevel: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5,
    },
  },

  energyLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5,
    },
  },
  // follow-up answers vary depending on what the user selected for pain and mood
  // JSON lets us store whatever shape of data comes back without needing extra columns
  anxietyLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 5 },
  },
  appetiteLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 5 },
  },
  // asked only on the first check-in of the day, skippable even then —
  // null = not asked (a later same-day check-in) or skipped
  sleepLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 5 },
  },
  symptoms: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  followUpData: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  // One optional line of the user's own words — the context a 1-to-5 scale
  // cannot hold. At most 280 characters (enforced in lib/checkInNote.js), null
  // when not given, and deliberately never read by the insight engine: see the
  // explicit `attributes` list in controllers/insightController.js.
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // storing just the date without time - we only need to know which day the check-in was for
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    // defaults to today so we don't have to send the date from the frontend every time
    defaultValue: DataTypes.NOW,
  },
}, {
  // the hot query is "this user's check-ins, most recent first / within a range",
  // so index the (userId, date) access path
  indexes: [{ fields: ["userId", "date"] }],
});

// a user can have many check-ins over time
// if the user gets deleted, all their check-ins get deleted too - that's what CASCADE means
User.hasMany(CheckIn, { foreignKey: "userId", onDelete: "CASCADE" });
// each check-in belongs to exactly one user
// userId is the foreign key that links the two tables together
CheckIn.belongsTo(User, { foreignKey: "userId" });

module.exports = CheckIn;
