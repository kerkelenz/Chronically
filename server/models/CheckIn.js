const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const CheckIn = sequelize.define("CheckIn", {
  painLevel: {
    type: DataTypes.ENUM("light", "moderate", "severe"),
    allowNull: false,
  },
  moodLevel: {
    type: DataTypes.ENUM("good", "okay", "low"),
    allowNull: false,
  },
  followUpData: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

User.hasMany(CheckIn, { foreignKey: "userId", onDelete: "CASCADE" });
CheckIn.belongsTo(User, { foreignKey: "userId" });

module.exports = CheckIn;
