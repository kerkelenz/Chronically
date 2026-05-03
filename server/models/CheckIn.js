const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
// importing User here because we need to define the relationship between the two models
const User = require("./User");

// defining the CheckIn table - this is what gets stored every time someone does a daily check-in
const CheckIn = sequelize.define("CheckIn", {
  // painLevel can only be one of these three values - ENUM prevents anything else getting in
  painLevel: {
    type: DataTypes.ENUM("light", "moderate", "severe"),
    // every check-in must have a pain level - can't submit without it
    allowNull: false,
  },
  // same idea for mood - locked to three options to keep the data consistent
  moodLevel: {
    type: DataTypes.ENUM("good", "okay", "low"),
    allowNull: false,
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
