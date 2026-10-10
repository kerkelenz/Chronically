const { Op } = require("sequelize");
const Medication = require("../models/Medication");
const MedicationLog = require("../models/MedicationLog");
const { sequelize } = require("../config/db");
const MedicationChange = require("../models/MedicationChange");
const { resolvePattern } = require("../lib/medSchedule");
const { projectMedication, diffMedication, snapshotChanges, derivedCreatedEntry } = require("../lib/medHistory");
const { supplyStatus, summarizeHelped, HELPED_WINDOW_DAYS } = require("../lib/medStats");
const { isYmd } = require("../lib/trends");

// Supply fields are optional and independently validated, so an older app build
// that sends none of them can never clear what a newer one set.
const validateSupplyFields = ({ supplyCount, unitsPerDose, refillReminderDays }) => {
  if (supplyCount !== undefined && supplyCount !== null) {
    if (!Number.isInteger(supplyCount) || supplyCount < 0 || supplyCount > 9999) {
      return "supplyCount must be a whole number from 0 to 9999";
    }
  }
  if (unitsPerDose !== undefined && unitsPerDose !== null) {
    const n = Number(unitsPerDose);
    // halves only: a third of a tablet is not a thing anyone counts
    if (!Number.isFinite(n) || n < 0.5 || n > 50 || Math.round(n * 2) !== n * 2) {
      return "unitsPerDose must be between 0.5 and 50, in halves";
    }
  }
  if (refillReminderDays !== undefined && refillReminderDays !== null) {
    if (!Number.isInteger(refillReminderDays) || refillReminderDays < 1 || refillReminderDays > 60) {
      return "refillReminderDays must be a whole number from 1 to 60";
    }
  }
  return null;
};


const HELPED_VALUES = ["yes", "a_little", "no"];

/**
 * `helped` is the user's own note on an as-needed dose. It is only meaningful
 * on a dose that was actually taken, and only for a medication taken as
 * needed — a scheduled dose has no "did it help" question attached to it.
 * Anything else is a client bug, so it is refused rather than dropped.
 */
const validateHelped = (helped, { medication, status }) => {
  if (helped === undefined || helped === null) return null;
  if (!HELPED_VALUES.includes(helped)) {
    return "helped must be yes, a_little, no or empty";
  }
  if (status !== "taken") {
    return "helped can only be set on a dose that was taken";
  }
  if (resolvePattern(medication).kind !== "as_needed") {
    return "helped can only be set on an as-needed medication";
  }
  return null;
};

/**
 * Attaches the computed `supply` and `helped` figures to medications on their
 * way out. The clients only ever fetch seven days of logs, so they cannot work
 * either of these out themselves — which is the point: one definition, on the
 * server, at read time.
 *
 * Two queries at most, and only for the medications that need them.
 */
async function decorate(medications, userId) {
  const list = Array.isArray(medications) ? medications : [medications];
  const plain = list.map((m) => (typeof m.toJSON === "function" ? m.toJSON() : { ...m }));

  const tracked = plain.filter((m) => m.supplyCount != null);
  const prn = plain.filter((m) => resolvePattern(m).kind === "as_needed");

  let supplyLogs = [];
  if (tracked.length) {
    // one query from the earliest period start, then split per medication
    const starts = tracked.map((m) => (m.supplyUpdatedAt ? new Date(m.supplyUpdatedAt).getTime() : 0));
    const earliest = new Date(Math.min(...starts));
    supplyLogs = await MedicationLog.findAll({
      attributes: ["medicationId", "date", "scheduledTime", "status", "takenAt", "createdAt"],
      where: {
        userId,
        medicationId: { [Op.in]: tracked.map((m) => m.id) },
        status: "taken",
        createdAt: { [Op.gte]: earliest },
      },
      raw: true,
    });
  }

  let helpedLogs = [];
  if (prn.length) {
    const since = new Date(Date.now() - HELPED_WINDOW_DAYS * 86400000);
    helpedLogs = await MedicationLog.findAll({
      attributes: ["medicationId", "status", "helped", "takenAt", "createdAt"],
      where: {
        userId,
        medicationId: { [Op.in]: prn.map((m) => m.id) },
        status: "taken",
        helped: { [Op.ne]: null },
        createdAt: { [Op.gte]: since },
      },
      raw: true,
    });
  }

  const now = new Date();
  for (const m of plain) {
    m.supply = m.supplyCount == null
      ? null
      : supplyStatus(m, supplyLogs.filter((l) => l.medicationId === m.id), now);
    m.helped = resolvePattern(m).kind === "as_needed"
      ? summarizeHelped(helpedLogs.filter((l) => l.medicationId === m.id), now)
      : null;
  }
  return Array.isArray(medications) ? plain : plain[0];
}

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
    res.json({ medications: await decorate(medications, req.user.id) });
  } catch (error) {
    console.error("Get medications error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Only patches carry a removal offset — switching a med away from "patch" must
// clear it, or a stale value would keep firing removal reminders for a pill.
const normalizeRemovalHours = (type, hours) => {
  if (type !== "patch") return null;
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(168, Math.round(n));
};

const createMedication = async (req, res) => {
  try {
    const { name, type, dosage, frequency, frequencyWeeks, scheduledTimes, notes, active, daysOfWeek, startDate, intervalDays, removalOffsetHours,
      supplyCount, unitsPerDose, refillReminderDays } = req.body;
    const scheduleError = validateScheduleFields({ daysOfWeek, startDate, intervalDays });
    if (scheduleError) return res.status(400).json({ error: scheduleError });
    const supplyError = validateSupplyFields({ supplyCount, unitsPerDose, refillReminderDays });
    if (supplyError) return res.status(400).json({ error: supplyError });

    // the medication and its first history row land together or not at all
    const medication = await sequelize.transaction(async (t) => {
      const created = await Medication.create({
        userId: req.user.id,
        name, type, dosage, frequency, frequencyWeeks, scheduledTimes, notes,
        daysOfWeek, startDate, intervalDays,
        removalOffsetHours: normalizeRemovalHours(type, removalOffsetHours),
        active: active !== undefined ? active : true,
        supplyCount: supplyCount ?? null,
        // the count is only meaningful alongside the moment it was counted, and
        // that moment is the server's to set, never the client's
        supplyUpdatedAt: supplyCount != null ? new Date() : null,
        ...(unitsPerDose !== undefined && unitsPerDose !== null ? { unitsPerDose } : {}),
        ...(refillReminderDays !== undefined ? { refillReminderDays } : {}),
      }, { transaction: t });

      await MedicationChange.create({
        userId: req.user.id,
        medicationId: created.id,
        kind: "created",
        changes: snapshotChanges(created),
      }, { transaction: t });

      return created;
    });
    res.status(201).json({ medication: await decorate(medication, req.user.id) });
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

    const { name, type, dosage, frequency, frequencyWeeks, scheduledTimes, notes, active, daysOfWeek, startDate, intervalDays, removalOffsetHours,
      supplyCount, unitsPerDose, refillReminderDays } = req.body;
    const scheduleError = validateScheduleFields({ daysOfWeek, startDate, intervalDays });
    if (scheduleError) return res.status(400).json({ error: scheduleError });
    const supplyError = validateSupplyFields({ supplyCount, unitsPerDose, refillReminderDays });
    if (supplyError) return res.status(400).json({ error: supplyError });

    const patch = {
      name, type, dosage, frequency, frequencyWeeks, scheduledTimes, notes, active,
      daysOfWeek, startDate, intervalDays,
    };

    // The pause button sends only { active }. Recomputing the removal offset
    // from an undefined `type` wrote null over it, so pausing a patch silently
    // stopped its removal reminders — and resuming did not bring them back.
    // Only touch it when the request is actually about the type or the offset.
    if (type !== undefined || removalOffsetHours !== undefined) {
      patch.removalOffsetHours = normalizeRemovalHours(
        type ?? medication.type,
        removalOffsetHours !== undefined ? removalOffsetHours : medication.removalOffsetHours,
      );
    }

    // Supply keys are applied only when sent, so an older build that omits
    // them cannot wipe what a newer one stored.
    if (supplyCount !== undefined) {
      patch.supplyCount = supplyCount;
      if (supplyCount === null) {
        patch.supplyUpdatedAt = null;             // stopped tracking
      } else if (Number(supplyCount) !== Number(medication.supplyCount)) {
        patch.supplyUpdatedAt = new Date();       // a new count starts a new period
      }
    }
    if (unitsPerDose !== undefined && unitsPerDose !== null) patch.unitsPerDose = unitsPerDose;
    if (refillReminderDays !== undefined) patch.refillReminderDays = refillReminderDays;

    const before = projectMedication(medication.toJSON());
    const wasActive = medication.active;

    await sequelize.transaction(async (t) => {
      await medication.update(patch, { transaction: t });
      const changes = diffMedication(before, projectMedication(medication.toJSON()));

      // A dosage or schedule edit is recorded first, so the history reads in
      // the order somebody would describe it.
      if (changes.length > 0) {
        await MedicationChange.create({
          userId: req.user.id, medicationId: medication.id, kind: "changed", changes,
        }, { transaction: t });
      }
      // Pausing is not a schedule change, so it gets its own row with no
      // fields. Both can happen in one request.
      if (medication.active !== wasActive) {
        await MedicationChange.create({
          userId: req.user.id,
          medicationId: medication.id,
          kind: medication.active ? "reactivated" : "deactivated",
          changes: [],
        }, { transaction: t });
      }
    });

    res.json({ medication: await decorate(medication, req.user.id) });
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

/**
 * A refill is a new count, not an adjustment: it always moves
 * supplyUpdatedAt, even when the number is the same as before, because the
 * period it starts is what the arithmetic (and the once-per-period reminder
 * claim) is keyed on.
 */
const refillMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!medication) return res.status(404).json({ error: "Medication not found" });

    const { supplyCount } = req.body;
    if (supplyCount === undefined || supplyCount === null) {
      return res.status(400).json({ error: "supplyCount must be a whole number from 0 to 9999" });
    }
    const supplyError = validateSupplyFields({ supplyCount });
    if (supplyError) return res.status(400).json({ error: supplyError });

    await medication.update({ supplyCount, supplyUpdatedAt: new Date() });
    res.json({ medication: await decorate(medication, req.user.id) });
  } catch (error) {
    console.error("Refill medication error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Newest first. When there is no stored `created` row -- every medication that
 * predates this feature -- a single derived "Added" entry is appended from the
 * medication's own createdAt, carrying no field values because we genuinely do
 * not know what they were. It is never written to the database: reading a
 * history must not create one.
 */
const getMedicationHistory = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!medication) return res.status(404).json({ error: "Medication not found" });

    const rows = await MedicationChange.findAll({
      where: { medicationId: medication.id, userId: req.user.id },
      order: [["changedAt", "DESC"], ["id", "DESC"]],
      raw: true,
    });

    const entries = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      changedAt: r.changedAt,
      changes: Array.isArray(r.changes) ? r.changes : [],
    }));

    if (!rows.some((r) => r.kind === "created")) entries.push(derivedCreatedEntry(medication));

    res.json({ entries });
  } catch (error) {
    console.error("Get medication history error:", error);
    res.status(500).json({ error: "Server error" });
  }
};


/**
 * GET /api/medications/changes?startDate&endDate — every medication's history
 * entries in a range, for the Trends chart's markers. The client buckets by its
 * own local date, so the timestamp filter is padded by a day each side and the
 * client drops what falls outside. Includes the same derived "Added" entry as
 * the per-medication history.
 */
const getMedicationChanges = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!isYmd(startDate) || !isYmd(endDate) || startDate > endDate) {
      return res.status(400).json({ error: "Choose a valid date range." });
    }
    const from = new Date(Date.parse(`${startDate}T00:00:00Z`) - 86400000);
    const to = new Date(Date.parse(`${endDate}T00:00:00Z`) + 2 * 86400000);
    const uid = req.user.id;

    const [meds, rows, createdRows] = await Promise.all([
      Medication.findAll({ where: { userId: uid }, attributes: ["id", "name", "createdAt"], raw: true }),
      MedicationChange.findAll({
        where: { userId: uid, changedAt: { [Op.gte]: from, [Op.lt]: to } },
        order: [["changedAt", "ASC"], ["id", "ASC"]],
        raw: true,
      }),
      // which medications have a stored "created" row at all, whenever it was
      MedicationChange.findAll({ where: { userId: uid, kind: "created" }, attributes: ["medicationId"], raw: true }),
    ]);

    const byId = new Map(meds.map((m) => [m.id, m]));
    const hasCreated = new Set(createdRows.map((r) => r.medicationId));
    const changes = rows
      .filter((r) => byId.has(r.medicationId))
      .map((r) => ({
        id: r.id,
        medicationId: r.medicationId,
        medicationName: byId.get(r.medicationId).name,
        kind: r.kind,
        changedAt: r.changedAt,
        changes: Array.isArray(r.changes) ? r.changes : [],
      }));
    for (const m of meds) {
      if (hasCreated.has(m.id)) continue;
      const at = new Date(m.createdAt);
      if (at >= from && at < to) {
        changes.push({ ...derivedCreatedEntry(m), medicationId: m.id, medicationName: m.name });
      }
    }
    changes.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));

    res.json({ changes });
  } catch (error) {
    console.error("Get medication changes error:", error);
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
    const { medicationId, date, scheduledTime, takenAt, status, skipReason, helped } = req.body;

    // make sure the medication being logged actually belongs to this user
    const medication = await Medication.findOne({
      where: { id: medicationId, userId: req.user.id },
    });
    if (!medication) return res.status(404).json({ error: "Medication not found" });

    const helpedError = validateHelped(helped, { medication, status });
    if (helpedError) return res.status(400).json({ error: helpedError });

    const log = await MedicationLog.create({
      userId: req.user.id,
      medicationId, date, scheduledTime, takenAt, status, skipReason,
      helped: helped ?? null,
    });
    // the medication comes back decorated so the card's count updates without
    // a refetch; additive, so older clients just ignore it
    res.status(201).json({ log, medication: await decorate(medication, req.user.id) });
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

    const { takenAt, status, skipReason, helped } = req.body;
    const medication = await Medication.findOne({
      where: { id: log.medicationId, userId: req.user.id },
    });
    if (!medication) return res.status(404).json({ error: "Medication not found" });

    const nextStatus = status !== undefined ? status : log.status;
    const helpedError = validateHelped(helped, { medication, status: nextStatus });
    if (helpedError) return res.status(400).json({ error: helpedError });

    const patch = { takenAt, status, skipReason };
    if (helped !== undefined) {
      patch.helped = helped;
    }
    // a dose that is no longer "taken" cannot carry a rating of how it went
    if (nextStatus !== "taken") patch.helped = null;

    await log.update(patch);
    const med = medication;
    res.json({ log, medication: med ? await decorate(med, req.user.id) : null });
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
    const medicationId = log.medicationId;
    await log.destroy();
    const med = await Medication.findOne({ where: { id: medicationId, userId: req.user.id } });
    res.status(200).json({
      message: "Log entry removed",
      medication: med ? await decorate(med, req.user.id) : null,
    });
  } catch (error) {
    console.error("Delete medication log error:", error);
    res.status(500).json({ error: "Server error removing log entry" });
  }
};

module.exports = { getMedications, createMedication, updateMedication, deleteMedication, refillMedication, getMedicationHistory,
  getMedicationChanges, getLogs, createLog, updateLog, deleteMedicationLog };
