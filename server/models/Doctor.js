const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const { normalizeName } = require("../lib/doctors");

// A doctor the user chose to keep, so adding an appointment doesn't mean
// retyping the same three strings. Deliberately NOT linked to Appointment by a
// foreign key: an appointment stores its own copy of the name, specialty and
// location, so editing or removing a saved doctor leaves past appointments and
// exported reports exactly as they were. The connection between the two is the
// normalized name, computed in one place (lib/doctors) and stored here.
//
// No phone, email or notes — this is a form-filler, not an address book.
const Doctor = sequelize.define("Doctor", {
  userId:    { type: DataTypes.INTEGER, allowNull: false },
  name:      { type: DataTypes.STRING, allowNull: false },
  // The comparison form of `name`. Stored rather than computed per query so the
  // unique index below can enforce "one row per doctor per user" in the
  // database, where a race can't get around it.
  nameKey:   { type: DataTypes.STRING, allowNull: false },
  specialty: { type: DataTypes.STRING, allowNull: true },
  location:  { type: DataTypes.STRING, allowNull: true },
}, {
  hooks: {
    // Derived in a hook, never by the caller, so nameKey cannot drift from name
    // — a renamed doctor whose key stayed behind would silently stop matching
    // its own appointments. Runs on create and on instance.update(); the
    // controller uses instance updates for exactly that reason, since the
    // static Model.update() skips per-row hooks unless asked.
    beforeValidate: (doctor, options) => {
      doctor.nameKey = normalizeName(doctor.name);
      // instance.update({ name }) restricts the UPDATE to the fields it was
      // handed, so a column derived in a hook has to add itself or it is
      // computed and then silently thrown away — leaving a renamed doctor
      // keyed to their old name, matching the wrong appointments forever.
      if (options && Array.isArray(options.fields) && !options.fields.includes("nameKey")) {
        options.fields.push("nameKey");
      }
    },
  },
  indexes: [
    // one saved doctor per name per user; a rename onto an existing name is
    // rejected here and reported as a 409 rather than quietly duplicating
    { unique: true, fields: ["userId", "nameKey"] },
  ],
});

User.hasMany(Doctor, { foreignKey: "userId", onDelete: "CASCADE" });
Doctor.belongsTo(User, { foreignKey: "userId" });

module.exports = Doctor;
