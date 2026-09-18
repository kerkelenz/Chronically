const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

// A product update written in Chronicle's voice and shown as a dismissible card
// on the dashboard. In-app only — never pushed. Apple 4.5.4 treats promotional
// push as marketing needing its own opt-in, and this channel sidesteps that
// question entirely by never leaving the app.
const Announcement = sequelize.define("Announcement", {
  title: { type: DataTypes.STRING, allowNull: false },
  // plain text; line breaks are preserved when rendered, never HTML
  body:  { type: DataTypes.TEXT, allowNull: false },
  // null = draft. Publishing is an explicit act, never a side effect of saving.
  publishedAt: { type: DataTypes.DATE, allowNull: true },
  // optional auto-hide; null = shows until dismissed
  expiresAt:   { type: DataTypes.DATE, allowNull: true },
  createdBy:   { type: DataTypes.INTEGER, allowNull: false },
}, {
  // the user-facing query filters on publishedAt and orders by it
  indexes: [{ fields: ["publishedAt"] }],
});

User.hasMany(Announcement, { foreignKey: "createdBy", onDelete: "CASCADE" });
Announcement.belongsTo(User, { foreignKey: "createdBy", as: "author" });

module.exports = Announcement;
