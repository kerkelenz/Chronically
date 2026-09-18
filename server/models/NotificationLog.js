const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

// A record of every notification actually sent. This exists for exactly one
// reason: the unique constraint below makes a double-send impossible. The cron
// runs every 5 minutes and a tick can overlap the previous one, the process can
// restart mid-run, and a future second instance would run the same job — in all
// three cases the insert fails and the send is skipped rather than repeated.
//
// `scheduledFor` is the moment the notification was *for*, not when it was sent,
// so it is stable across retries: the 08:00 dose on the 4th is always the same
// key no matter which tick picks it up.
const NotificationLog = sequelize.define("NotificationLog", {
  userId:       { type: DataTypes.INTEGER, allowNull: false },
  kind:         { type: DataTypes.ENUM("med", "removal", "nudge"), allowNull: false },
  // medicationId for med/removal, 0 for the nudge (which isn't about any one
  // medication). NOT NULL on purpose: Postgres treats NULLs as distinct in a
  // unique index, so a nullable refId would let two identical nudge rows both
  // insert and defeat the guard this table exists for.
  refId:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  scheduledFor: { type: DataTypes.DATE, allowNull: false },
  sentAt:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  indexes: [
    // the double-send guard: a duplicate insert throws and the send is skipped
    { unique: true, fields: ["userId", "kind", "refId", "scheduledFor"] },
  ],
});

User.hasMany(NotificationLog, { foreignKey: "userId", onDelete: "CASCADE" });
NotificationLog.belongsTo(User, { foreignKey: "userId" });

module.exports = NotificationLog;
