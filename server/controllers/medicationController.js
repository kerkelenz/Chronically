const Medication = require("../models/Medication");
const MedicationLog = require("../models/MedicationLog");

// light validation for the schedule-pattern fields - returns an error string or null
const validateScheduleFields = ({ daysOfWeek, startDate, intervalDays }) => {
  if (daysOfWeek != null) {
    const ok =
      Array.isArray(daysOfWeek) &&
      daysOfWeek.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (!ok) return "daysOfWeek must be an array of integers 0-6";
  }
  if (intervalDays != null) {
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 90) {
      return "intervalDays must be a whole number between 1 and 90";
    }
  }
  if (startDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return "startDate must be a YYYY-MM-DD date";
  }
  return null;
};

const getMedications = async (req, res) => {
  try {
    const medications = await Medication.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "ASC"]],
    });
    res.json({ medications });
  } catch (error) {
    console.error("Get medications error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const createMedication = async (req, res) => {
  try {
    const { name, type, dosage, frequency, frequencyWeeks, scheduledTimes, notes, active, daysOfWeek, startDate, intervalDays } = req.body;
    const scheduleError = validateScheduleFields({ daysOfWeek, startDate, intervalDays });
    if (scheduleError) return res.status(400).json({ error: scheduleError });
    const medication = await Medication.create({
      userId: req.user.id,
      name, type, dosage, frequency, frequencyWeeks, scheduledTimes, notes,
      daysOfWeek, startDate, intervalDays,
      active: active !== undefined ? active : true,
    });
    res.status(201).json({ medication });
  } catch (error) {
    console.error("Create medication error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!medication) return res.status(404).json({ error: "Medication not found" });

    const { name, type, dosage, frequency, frequencyWeeks, scheduledTimes, notes, active, daysOfWeek, startDate, intervalDays } = req.body;
    const scheduleError = validateScheduleFields({ daysOfWeek, startDate, intervalDays });
    if (scheduleError) return res.status(400).json({ error: scheduleError });
    await medication.update({ name, type, dosage, frequency, frequencyWeeks, scheduledTimes, notes, active, daysOfWeek, startDate, intervalDays });
    res.json({ medication });
  } catch (error) {
    console.error("Update medication error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!medication) return res.status(404).json({ error: "Medication not found" });

    await medication.destroy();
    res.json({ message: "Medication deleted" });
  } catch (error) {
    console.error("Delete medication error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const getLogs = async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const where = { userId: req.user.id };
    if (req.query.date) {
      where.date = req.query.date;
    } else if (req.query.startDate && req.query.endDate) {
      where.date = { [Op.between]: [req.query.startDate, req.query.endDate] };
    } else if (req.query.startDate) {
      where.date = { [Op.gte]: req.query.startDate };
    }

    const logs = await MedicationLog.findAll({ where, order: [["date", "ASC"], ["createdAt", "ASC"]] });
    res.json({ logs });
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const createLog = async (req, res) => {
  try {
    const { medicationId, date, scheduledTime, takenAt, status, skipReason } = req.body;

    // make sure the medication being logged actually belongs to this user
    const medication = await Medication.findOne({
      where: { id: medicationId, userId: req.user.id },
    });
    if (!medication) return res.status(404).json({ error: "Medication not found" });

    const log = await MedicationLog.create({
      userId: req.user.id,
      medicationId, date, scheduledTime, takenAt, status, skipReason,
    });
    res.status(201).json({ log });
  } catch (error) {
    console.error("Create log error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateLog = async (req, res) => {
  try {
    const log = await MedicationLog.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!log) return res.status(404).json({ error: "Log not found" });

    const { takenAt, status, skipReason } = req.body;
    await log.update({ takenAt, status, skipReason });
    res.json({ log });
  } catch (error) {
    console.error("Update log error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteMedicationLog = async (req, res) => {
  try {
    const log = await MedicationLog.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!log) return res.status(404).json({ error: "Log entry not found" });
    await log.destroy();
    res.status(200).json({ message: "Log entry removed" });
  } catch (error) {
    console.error("Delete medication log error:", error);
    res.status(500).json({ error: "Server error removing log entry" });
  }
};

module.exports = { getMedications, createMedication, updateMedication, deleteMedication, getLogs, createLog, updateLog, deleteMedicationLog };
