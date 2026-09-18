const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

// One row per device that has opted in to notifications. A user can have
// several (phone, tablet, a reinstall that produced a fresh token), and a
// device that changes hands re-registers its token under the new account —
// which is why `token` is unique rather than (userId, token).
const PushToken = sequelize.define("PushToken", {
  userId:   { type: DataTypes.INTEGER, allowNull: false },
  token:    { type: DataTypes.STRING, allowNull: false, unique: true },
  platform: { type: DataTypes.ENUM("ios", "android"), allowNull: false },
}, {
  // the scheduler loads every token for a user on each tick
  indexes: [{ fields: ["userId"] }],
});

User.hasMany(PushToken, { foreignKey: "userId", onDelete: "CASCADE" });
PushToken.belongsTo(User, { foreignKey: "userId" });

module.exports = PushToken;
