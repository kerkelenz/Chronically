const { Op } = require("sequelize");
const CheckIn = require("../models/CheckIn");
const MedicationLog = require("../models/MedicationLog");
const SpoonDay = require("../models/SpoonDay");
const SpoonEntry = require("../models/SpoonEntry");
const { computeInsights, WINDOW_DAYS } = require("../lib/insights");

// getInsights handles GET /api/insights
// pulls the user's last-90-days check-ins, medication logs, and spoon days
// (all user-scoped, via their (userId, date) indexes) and hands them to the pure
// correlation engine.
const getInsights = async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    const cutoffStr = cutoff.toLocaleDateString("en-CA");
    const uid = req.user.id;

    const [checkIns, medLogs, spoonDayRows] = await Promise.all([
      CheckIn.findAll({
        attributes: [
          "date", "painLevel", "moodLevel", "energyLevel",
          "anxietyLevel", "appetiteLevel", "sleepLevel", "symptoms",
        ],
        where: { userId: uid, date: { [Op.gte]: cutoffStr } },
        order: [["date", "ASC"]],
        limit: 1000,
        raw: true,
      }),
      MedicationLog.findAll({
        attributes: ["date", "status"],
        where: { userId: uid, date: { [Op.gte]: cutoffStr } },
        limit: 5000,
        raw: true,
      }),
      SpoonDay.findAll({
        attributes: ["id", "date", "budget"],
        where: { userId: uid, date: { [Op.gte]: cutoffStr } },
        raw: true,
      }),
    ]);

    // fold each SpoonDay's entry costs into { date, budget, spent, entries }
    let spoonDays = [];
    if (spoonDayRows.length > 0) {
      const entries = await SpoonEntry.findAll({
        attributes: ["spoonDayId", "cost"],
        where: { userId: uid, spoonDayId: { [Op.in]: spoonDayRows.map((d) => d.id) } },
        raw: true,
      });
      const agg = {};
      for (const e of entries) {
        const a = (agg[e.spoonDayId] = agg[e.spoonDayId] || { spent: 0, entries: 0 });
        a.spent += e.cost;
        a.entries += 1;
      }
      spoonDays = spoonDayRows.map((d) => ({
        date: d.date,
        budget: d.budget,
        spent: agg[d.id]?.spent || 0,
        entries: agg[d.id]?.entries || 0,
      }));
    }

    res.json(computeInsights({ checkIns, medLogs, spoonDays }));
  } catch (err) {
    console.error("Get insights error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getInsights };
