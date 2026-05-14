const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
// importing User here because we need to define the relationship between the two models
const User = require("./User");

// defining the CheckIn table - this is what gets stored every time someone does a daily check-in
const CheckIn = sequelize.define("CheckIn", {
  // painLevel can only be one of these three values - ENUM prevents anything else getting in
  painLevel: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  // follow-up answers vary depending on what the user selected for pain and mood
  // JSON lets us store whatever shape of data comes back without needing extra columns
  followUpData: {
    type: DataTypes.JSON,
    // this one is optional because not every check-in will have follow-up answers
    allowNull: true,
  },
  // storing just the date without time - we only need to know which day the check-in was for
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    // defaults to today so we don't have to send the date from the frontend every time
    defaultValue: DataTypes.NOW,
  },
});

// a user can have many check-ins over time
// if the user gets deleted, all their check-ins get deleted too - that's what CASCADE means
User.hasMany(CheckIn, { foreignKey: "userId", onDelete: "CASCADE" });
// each check-in belongs to exactly one user
// userId is the foreign key that links the two tables together
CheckIn.belongsTo(User, { foreignKey: "userId" });

module.exports = CheckIn;
