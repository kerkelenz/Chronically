const { DataTypes } = require("sequelize");
// importing the sequelize instance we created in db.js so all models use the same connection
const { sequelize } = require("../config/db");

// defining the User table - this represents everyone who has an account in Chronically
const User = sequelize.define("User", {
  username: {
    type: DataTypes.STRING,
    // every user needs a username
    allowNull: false,
    // no two users can have the same username
    unique: true,
    validate: {
      // username has to be between 3 and 30 characters
      // short enough to be readable, long enough to be meaningful
      len: [3, 30],
    },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    // email has to be unique too
    unique: true,
    validate: {
      // Sequelize has a built-in email validator
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      // minimum 8 characters - the hashed version will be much longer
      // max 100 just to prevent someone sending a ridiculously long string
      len: [8, 100],
    },
  },
});

module.exports = User;
