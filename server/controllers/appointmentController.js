const Appointment = require("../models/Appointment");

const getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      where: { userId: req.user.id },
      order: [["date", "ASC"]],
    });
    res.json({ appointments });
  } catch (error) {
    console.error("Get appointments error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const createAppointment = async (req, res) => {
  try {
    const { doctorName, specialty, date, location, reason, notesBefore, notesAfter, followUpDate, status } = req.body;
    const appointment = await Appointment.create({
      userId: req.user.id,
      doctorName, specialty, date, location, reason, notesBefore, notesAfter, followUpDate,
      status: status || "upcoming",
    });
    res.status(201).json({ appointment });
  } catch (error) {
    console.error("Create appointment error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    const { doctorName, specialty, date, location, reason, notesBefore, notesAfter, followUpDate, status } = req.body;
    await appointment.update({ doctorName, specialty, date, location, reason, notesBefore, notesAfter, followUpDate, status });
    res.json({ appointment });
  } catch (error) {
    console.error("Update appointment error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    await appointment.destroy();
    res.json({ message: "Appointment deleted" });
  } catch (error) {
    console.error("Delete appointment error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getAppointments, createAppointment, updateAppointment, deleteAppointment };
