const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Flare = require("../models/Flare");
const User = require("../models/User");
const {
  NOTE_MAX, isYmd, validateFlare, cleanNote, noteTooLong, todayFor,
} = require("../lib/flares");

// Only what the client needs; userId never leaves the server.
const shape = (f) => ({
  id: f.id,
  startDate: f.startDate,
  endDate: f.endDate,
  note: f.note,
});

const NOT_FOUND = { error: "Flare not found." };

// `id` reaches Postgres as a bind parameter against an integer column, so a
// non-numeric one is a cast error (a 500) rather than an empty result. Someone
// else's id and a nonsense id should look identical from outside: both 404.
const numericId = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

/**
 * Every write runs inside a transaction that locks the user row first. Two
 * requests from the same account — a phone and a browser, or a double tap —
 * would otherwise each read "no ongoing flare" and both insert one. Serialising
 * on the user means the second request sees the first one's work.
 */
const withUserLock = (req, fn) => sequelize.transaction(async (transaction) => {
  const user = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
  const others = await Flare.findAll({ where: { userId: req.user.id }, transaction });
  return fn({ transaction, user, others, today: todayFor(user?.timezone, new Date()) });
});

// A malformed range is ignored rather than rejected, which is what getCheckIns
// does: a bad query string should not stop someone seeing their own data.
const rangeWhere = (userId, startDate, endDate) => {
  const where = { userId };
  const from = isYmd(startDate) ? startDate : null;
  const to = isYmd(endDate) ? endDate : null;
  if (!from && !to) return where;

  // intersection, not containment: a flare spanning the range's edges belongs
  // in the answer. An ongoing flare has no end, so it intersects anything that
  // reaches its start. This is the contract wave 2's shading reads.
  const clauses = [];
  if (to) clauses.push({ startDate: { [Op.lte]: to } });
  if (from) clauses.push({ [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: from } }] });
  return { ...where, [Op.and]: clauses };
};

const getFlares = async (req, res) => {
  try {
    const flares = await Flare.findAll({
      where: rangeWhere(req.user.id, req.query.startDate, req.query.endDate),
      order: [["startDate", "DESC"], ["id", "DESC"]],
    });
    res.json({ flares: flares.map(shape) });
  } catch (error) {
    console.error("Get flares error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const createFlare = async (req, res) => {
  try {
    if (noteTooLong(req.body?.note)) {
      return res.status(400).json({ error: `Notes can be up to ${NOTE_MAX} characters.` });
    }
    const result = await withUserLock(req, async ({ transaction, others, today }) => {
      const candidate = {
        startDate: req.body?.startDate,
        // an absent endDate means ongoing, which is the common case
        endDate: req.body?.endDate ?? null,
      };
      const check = validateFlare(candidate, others, today);
      if (!check.ok) return { status: check.status, body: { error: check.error } };

      const flare = await Flare.create({
        userId: req.user.id,
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        note: cleanNote(req.body?.note),
      }, { transaction });
      return { status: 201, body: { flare: shape(flare) } };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    // the partial unique index is the real guarantee; a race that beats the
    // check above lands here and must read as the same refusal
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "You already have a flare going. End that one first." });
    }
    console.error("Create flare error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateFlare = async (req, res) => {
  try {
    if (noteTooLong(req.body?.note)) {
      return res.status(400).json({ error: `Notes can be up to ${NOTE_MAX} characters.` });
    }
    const result = await withUserLock(req, async ({ transaction, others, today }) => {
      const flare = others.find((f) => String(f.id) === String(req.params.id));
      if (!flare) return { status: 404, body: NOT_FOUND };

      // Merge onto the stored row: an absent key leaves that field alone, while
      // an explicit endDate: null re-opens the flare. This is how "It's eased"
      // ends one and how the editor's "Still going" toggle undoes that.
      const candidate = {
        startDate: "startDate" in (req.body || {}) ? req.body.startDate : flare.startDate,
        endDate: "endDate" in (req.body || {}) ? req.body.endDate : flare.endDate,
      };
      // a flare never conflicts with itself
      const rest = others.filter((f) => f.id !== flare.id);
      const check = validateFlare(candidate, rest, today);
      if (!check.ok) return { status: check.status, body: { error: check.error } };

      await flare.update({
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        note: "note" in (req.body || {}) ? cleanNote(req.body.note) : flare.note,
      }, { transaction });
      return { status: 200, body: { flare: shape(flare) } };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "You already have a flare going. End that one first." });
    }
    console.error("Update flare error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteFlare = async (req, res) => {
  try {
    // scoped by userId in the lookup, so another user's id is a 404 and never
    // reveals that the row exists
    const id = numericId(req.params.id);
    if (id === null) return res.status(404).json(NOT_FOUND);
    const flare = await Flare.findOne({ where: { id, userId: req.user.id } });
    if (!flare) return res.status(404).json(NOT_FOUND);
    // Check-ins are untouched on purpose: removing a flare removes the dates
    // the user marked, not any of the data underneath them.
    await flare.destroy();
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete flare error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getFlares, createFlare, updateFlare, deleteFlare };
