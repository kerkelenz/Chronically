const { DataTypes } = require("sequelize");
// importing the sequelize instance we created in db.js so all models use the same connection
const { sequelize } = require("../config/db");
const User = require("./User");

// first-party usage events - a small whitelisted set of app actions stored in
// our own database so we can see whether features are used, nothing more.
// no third-party analytics SDKs, nothing leaves our infrastructure
const Event = sequelize.define(
  "Event",
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // which whitelisted event this is, e.g. "checkin_completed"
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    // "web" | "android" | "ios"
    platform: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    appVersion: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // small optional extras per event, capped at ingest time
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    // when the event happened on the client, which can be earlier than when the
    // batch reaches us
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    // the questions we ask are "how often does X happen" and "what does this
    // user's activity look like", so index both access paths
    indexes: [
      { fields: ["name", "occurredAt"] },
      { fields: ["userId", "occurredAt"] },
    ],
  },
);

// cascade delete keeps our account-deletion promise - removing a user removes
// their events too
User.hasMany(Event, { foreignKey: "userId", onDelete: "CASCADE" });
Event.belongsTo(User, { foreignKey: "userId" });

module.exports = Event;
