const User = require("../models/User");
const CheckIn = require("../models/CheckIn");
const SpoonActivity = require("../models/SpoonActivity");
const SpoonDay = require("../models/SpoonDay");
const SpoonEntry = require("../models/SpoonEntry");

const DEFAULT_BASELINE = 12;

// the default activity library seeded for a user the first time they open Spoon Center
const DEFAULT_ACTIVITIES = [
  { name: "Shower", cost: 6 },
  { name: "Wash hair", cost: 3 },
  { name: "Get dressed", cost: 4 },
  { name: "Cook a meal", cost: 5 },
  { name: "Groceries", cost: 8 },
  { name: "Drive somewhere", cost: 4 },
  { name: "Work block", cost: 10 },
  { name: "Social visit", cost: 7 },
  { name: "Exercise / PT", cost: 8 },
  { name: "Housework", cost: 6 },
  { name: "Doctor appointment", cost: 8 },
];

// today's budget = baseline gently scaled by today's energy + pain (both 1-5, 5 = best)
// a rough day lands near 70-85% of baseline, a good one up to ~120%
function computeBudget(baseline, checkIn) {
  const base = baseline ?? DEFAULT_BASELINE;
  if (!checkIn) return base;
  const levels = [checkIn.energyLevel, checkIn.painLevel].filter(
    (v) => typeof v === "number"
  );
  if (levels.length === 0) return base;
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  let factor = 1 + 0.1 * (avg - 3);
  factor = Math.max(0.7, Math.min(1.2, factor));
  return Math.round(base * factor);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

const getBaseline = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    res.json({ baseline: user.spoonBaseline });
  } catch (error) {
    console.error("Error getting spoon baseline:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const setBaseline = async (req, res) => {
  try {
    const { baseline } = req.body;
    // baseline is a spoon count, so it should be a small positive whole number
    if (!Number.isInteger(baseline) || baseline < 1 || baseline > 100) {
      return res
        .status(400)
        .json({ error: "Baseline must be a whole number between 1 and 100" });
    }
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    await user.update({ spoonBaseline: baseline });
    res.json({ baseline: user.spoonBaseline });
  } catch (error) {
    console.error("Error setting spoon baseline:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const getActivities = async (req, res) => {
  try {
    // check if this user has ever had any activities (including archived ones)
    const total = await SpoonActivity.count({ where: { userId: req.user.id } });
    if (total === 0) {
      // seed the default library on first visit
      await SpoonActivity.bulkCreate(
        DEFAULT_ACTIVITIES.map((a) => ({ ...a, userId: req.user.id }))
      );
    }
    const activities = await SpoonActivity.findAll({
      where: { userId: req.user.id, archived: false },
      order: [["createdAt", "ASC"]],
    });
    res.json({ activities });
  } catch (error) {
    console.error("Error getting spoon activities:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const createActivity = async (req, res) => {
  try {
    const { name, cost, icon, pinned } = req.body;
    if (pinned !== undefined && typeof pinned !== "boolean") {
      return res.status(400).json({ error: "pinned must be a boolean" });
    }
    const activity = await SpoonActivity.create({
      userId: req.user.id,
      name,
      cost,
      icon,
      pinned: pinned === true,
    });
    res.status(201).json({ activity });
  } catch (error) {
    console.error("Error creating spoon activity:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateActivity = async (req, res) => {
  try {
    const activity = await SpoonActivity.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if ("pinned" in req.body && typeof req.body.pinned !== "boolean") {
      return res.status(400).json({ error: "pinned must be a boolean" });
    }
    // only update fields the client is allowed to change - spreading req.body
    // directly would let a request overwrite things like userId
    const allowed = ["name", "cost", "icon", "archived", "pinned"];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    await activity.update(updates);
    res.json({ activity });
  } catch (error) {
    console.error("Error updating spoon activity:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteActivity = async (req, res) => {
  try {
    const activity = await SpoonActivity.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    await activity.destroy();
    res.json({ message: "Activity deleted" });
  } catch (error) {
    console.error("Error deleting spoon activity:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const getDay = async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const checkIn = await CheckIn.findOne({
      where: { userId: req.user.id, date },
    });
    const user = await User.findByPk(req.user.id);

    // findOrCreate is atomic, so two simultaneous requests for the same day
    // can't race each other into a unique-constraint error
    const [day, created] = await SpoonDay.findOrCreate({
      where: { userId: req.user.id, date },
      defaults: {
        budget: computeBudget(user.spoonBaseline, checkIn),
        budgetEdited: false,
      },
    });

    if (!created && !day.budgetEdited) {
      // re-compute in case a check-in has landed since this day was first created
      const fresh = computeBudget(user.spoonBaseline, checkIn);
      if (fresh !== day.budget) {
        await day.update({ budget: fresh });
      }
    }

    const entries = await SpoonEntry.findAll({
      where: { spoonDayId: day.id },
      order: [
        ["position", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    res.json({ day, entries, baseline: user.spoonBaseline });
  } catch (error) {
    console.error("Error getting spoon day:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateDayBudget = async (req, res) => {
  try {
    const day = await SpoonDay.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!day) return res.status(404).json({ error: "Day not found" });
    await day.update({ budget: req.body.budget, budgetEdited: true });
    res.json({ day });
  } catch (error) {
    console.error("Error updating spoon day budget:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const addEntry = async (req, res) => {
  try {
    const day = await SpoonDay.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!day) return res.status(404).json({ error: "Day not found" });
    const { name, cost } = req.body;
    const count = await SpoonEntry.count({ where: { spoonDayId: day.id } });
    const entry = await SpoonEntry.create({
      spoonDayId: day.id,
      userId: req.user.id,
      name,
      cost,
      position: count,
    });
    res.status(201).json({ entry });
  } catch (error) {
    console.error("Error adding spoon entry:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateEntry = async (req, res) => {
  try {
    const entry = await SpoonEntry.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    // only update fields that were actually sent in the request body
    const allowed = ["name", "cost", "completed", "position"];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    await entry.update(updates);
    res.json({ entry });
  } catch (error) {
    console.error("Error updating spoon entry:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteEntry = async (req, res) => {
  try {
    const entry = await SpoonEntry.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    await entry.destroy();
    res.json({ message: "Entry deleted" });
  } catch (error) {
    console.error("Error deleting spoon entry:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getBaseline,
  setBaseline,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  getDay,
  updateDayBudget,
  addEntry,
  updateEntry,
  deleteEntry,
};
