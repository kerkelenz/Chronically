const { Op } = require("sequelize");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const { normalizeName, mergeDoctorSuggestions } = require("../lib/doctors");

// Matches the column width in the model. A doctor's name is not a free-text
// field people write paragraphs in; the cap is here so a malformed client
// can't push a 10MB string into the row.
const MAX_LEN = 200;

// Trim, collapse to null when empty, and cut to the column width. Returning
// null rather than "" keeps one representation of "nothing" in the database.
const clean = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, MAX_LEN);
};

// Everything the client needs; the internal nameKey stays on the server.
const shape = (doctor) => ({
  id: doctor.id,
  name: doctor.name,
  specialty: doctor.specialty,
  location: doctor.location,
  saved: true,
  lastSeen: null,
});

const getDoctors = async (req, res) => {
  try {
    const [saved, appointments] = await Promise.all([
      Doctor.findAll({
        where: { userId: req.user.id },
        attributes: ["id", "name", "nameKey", "specialty", "location"],
        raw: true,
      }),
      // only the columns the merge reads — this runs on every form open
      Appointment.findAll({
        where: { userId: req.user.id },
        attributes: ["doctorName", "specialty", "location", "date"],
        raw: true,
      }),
    ]);
    res.json({ doctors: mergeDoctorSuggestions(saved, appointments) });
  } catch (error) {
    console.error("Get doctors error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Upsert by (userId, nameKey). Called after an appointment is created, so it
// has to be forgiving: saving the same doctor twice is a no-op update, not an
// error the user sees.
const saveDoctor = async (req, res) => {
  try {
    const name = clean(req.body?.name);
    if (!name) return res.status(400).json({ error: "A doctor name is required." });

    const specialty = clean(req.body?.specialty);
    const location = clean(req.body?.location);
    const nameKey = normalizeName(name);

    const existing = await Doctor.findOne({ where: { userId: req.user.id, nameKey } });
    if (existing) {
      // Only fill in what the form actually provided. A blank specialty on this
      // appointment must not wipe the one the user saved earlier — clearing a
      // field is what the manager's edit form is for.
      const updates = {};
      if (specialty) updates.specialty = specialty;
      if (location) updates.location = location;
      if (Object.keys(updates).length) await existing.update(updates);
      return res.status(200).json({ doctor: shape(existing) });
    }

    const doctor = await Doctor.create({ userId: req.user.id, name, specialty, location });
    res.status(201).json({ doctor: shape(doctor) });
  } catch (error) {
    console.error("Save doctor error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateDoctor = async (req, res) => {
  try {
    // scoped by userId in the lookup, so another user's id is a 404 and never
    // reveals that the row exists
    const doctor = await Doctor.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const name = clean(req.body?.name);
    if (!name) return res.status(400).json({ error: "A doctor name is required." });

    const nameKey = normalizeName(name);
    if (nameKey !== doctor.nameKey) {
      const clash = await Doctor.findOne({
        where: { userId: req.user.id, nameKey, id: { [Op.ne]: doctor.id } },
      });
      if (clash) {
        return res.status(409).json({ error: "You already saved a doctor with that name." });
      }
    }

    // instance.update so the beforeValidate hook recomputes nameKey. Specialty
    // and location come straight through, so the edit form can clear them.
    await doctor.update({
      name,
      specialty: clean(req.body?.specialty),
      location: clean(req.body?.location),
    });
    res.json({ doctor: shape(doctor) });
  } catch (error) {
    // the unique index is the real guarantee; a race that beats the check above
    // lands here and still reads as a name clash rather than a 500
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "You already saved a doctor with that name." });
    }
    console.error("Update doctor error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    // Appointments are untouched on purpose: removing a saved doctor is about
    // the shortcut list, not about the user's history.
    await doctor.destroy();
    res.json({ message: "Doctor removed" });
  } catch (error) {
    console.error("Delete doctor error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getDoctors, saveDoctor, updateDoctor, deleteDoctor };
