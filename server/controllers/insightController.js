const { Op } = require("sequelize");
const CheckIn = require("../models/CheckIn");
const { computeInsights, WINDOW_DAYS } = require("../lib/insights");

// getInsights handles GET /api/insights
// pulls the user's last-90-days check-ins (metrics + symptoms + sleep only, via
// the (userId, date) index) and hands them to the pure correlation engine
const getInsights = async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    const cutoffStr = cutoff.toLocaleDateString("en-CA");

    const checkIns = await CheckIn.findAll({
      attributes: [
        "date", "painLevel", "moodLevel", "energyLevel",
        "anxietyLevel", "appetiteLevel", "sleepLevel", "symptoms",
      ],
      where: { userId: req.user.id, date: { [Op.gte]: cutoffStr } },
      order: [["date", "ASC"]],
      limit: 1000,
      raw: true,
    });

    res.json(computeInsights(checkIns));
  } catch (err) {
    console.error("Get insights error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getInsights };
