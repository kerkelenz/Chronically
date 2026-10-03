const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

// One row per user per date. Weather is a property of the day, not of each
// check-in — somebody who logs three times on a rough Tuesday shares one sky.
//
// Captured only for users who have set a location, and kept even if they later
// clear it: the days they already lived through are part of their record.
const WeatherDay = sequelize.define("WeatherDay", {
  userId:          { type: DataTypes.INTEGER, allowNull: false },
  date:            { type: DataTypes.DATEONLY, allowNull: false },
  tempMaxC:        { type: DataTypes.FLOAT, allowNull: true },
  tempMinC:        { type: DataTypes.FLOAT, allowNull: true },
  // daily mean sea-level pressure — the field Phase 2's correlations hang on,
  // and the one this audience actually asks about
  pressureHpa:     { type: DataTypes.FLOAT, allowNull: true },
  humidityPct:     { type: DataTypes.FLOAT, allowNull: true },
  precipitationMm: { type: DataTypes.FLOAT, allowNull: true },
  weatherCode:     { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [
    // one sky per user per day; also the lookup the capture path checks first
    { unique: true, fields: ["userId", "date"] },
    { fields: ["userId"] },
  ],
});

User.hasMany(WeatherDay, { foreignKey: "userId", onDelete: "CASCADE" });
WeatherDay.belongsTo(User, { foreignKey: "userId" });

module.exports = WeatherDay;
