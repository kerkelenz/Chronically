const { Op } = require("sequelize");
const CheckIn = require("../models/CheckIn");
const {
  isYmd, dayCount, previousWindow, dailyMeans, comparePeriods, roundedDays, MIN_COMPARE_DAYS,
} = require("../lib/trends");

// getTrendSummary handles GET /api/trends/summary?startDate&endDate
// The client sends its own local dates (as it does for medication logs); the
// window it gets back is the one used. Reads the range and the same number of
// days before it, so the comparison needs no second request.
const getTrendSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!isYmd(startDate) || !isYmd(endDate) || startDate > endDate || dayCount(startDate, endDate) > 366) {
      return res.status(400).json({ error: "Choose a range of up to a year." });
    }
    const { prevStartDate, prevEndDate } = previousWindow(startDate, endDate);
    const uid = req.user.id;

    const [rows, any] = await Promise.all([
      CheckIn.findAll({
        attributes: ["date", "painLevel", "moodLevel", "energyLevel", "anxietyLevel", "appetiteLevel", "sleepLevel"],
        where: { userId: uid, date: { [Op.between]: [prevStartDate, endDate] } },
        limit: 5000,
        raw: true,
      }),
      // tells "never checked in" apart from "nothing in this range"
      CheckIn.findOne({ where: { userId: uid }, attributes: ["id"], raw: true }),
    ]);

    res.json({
      window: { startDate, endDate, prevStartDate, prevEndDate },
      days: roundedDays(dailyMeans(rows, startDate, endDate)),
      comparison: comparePeriods(rows, { startDate, endDate }).metrics,
      minDays: MIN_COMPARE_DAYS,
      everLogged: Boolean(any),
    });
  } catch (error) {
    console.error("Get trend summary error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getTrendSummary };
