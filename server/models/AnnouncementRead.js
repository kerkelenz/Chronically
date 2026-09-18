const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const Announcement = require("./Announcement");

// One row per user per announcement they've dismissed. Its presence is the
// whole signal: the user-facing query excludes any announcement that already
// has a row here, so a dismissed card can never come back.
const AnnouncementRead = sequelize.define("AnnouncementRead", {
  userId:         { type: DataTypes.INTEGER, allowNull: false },
  announcementId: { type: DataTypes.INTEGER, allowNull: false },
  dismissedAt:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  indexes: [
    // dismissing twice (a double tap, a retry) must not create a second row
    { unique: true, fields: ["userId", "announcementId"] },
    { fields: ["userId"] },
  ],
});

User.hasMany(AnnouncementRead, { foreignKey: "userId", onDelete: "CASCADE" });
AnnouncementRead.belongsTo(User, { foreignKey: "userId" });
Announcement.hasMany(AnnouncementRead, { foreignKey: "announcementId", onDelete: "CASCADE" });
AnnouncementRead.belongsTo(Announcement, { foreignKey: "announcementId" });

module.exports = AnnouncementRead;
