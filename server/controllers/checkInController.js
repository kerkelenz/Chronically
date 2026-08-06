const { Op } = require("sequelize");
const CheckIn = require("../models/CheckIn");
const User = require("../models/User");

// createCheckIn handles POST /api/checkins
// saves a new daily check-in to the database for the logged in user
const createCheckIn = async (req, res) => {
  try {
    // pull the check-in data out of the request body
    const { painLevel, moodLevel, energyLevel, anxietyLevel, appetiteLevel, symptoms, followUpData, date } = req.body;

    // pain and mood are required - can't save a check-in without them
    if (!painLevel || !moodLevel) {
      return res
        .status(400)
        .json({ error: "Pain level and mood level are required" });
    }

    const checkIn = await CheckIn.create({
      userId: req.user.id,
      painLevel,
      moodLevel,
      energyLevel: energyLevel || null,
      anxietyLevel: anxietyLevel || null,
      appetiteLevel: appetiteLevel || null,
      symptoms: symptoms || null,
      date: date || new Date(),
      followUpData: followUpData || null,
    });

    // using a symptom again un-hides it from suggestions — non-fatal so a
    // hiccup here never fails the check-in itself
    try {
      const saved = Array.isArray(checkIn.symptoms) ? checkIn.symptoms : [];
      if (saved.length > 0) {
        const user = await User.findByPk(req.user.id);
        const hidden = Array.isArray(user.hiddenSymptoms) ? user.hiddenSymptoms : [];
        if (hidden.length > 0) {
          const savedLower = new Set(saved.map((s) => s.toLowerCase()));
          const next = hidden.filter((h) => !savedLower.has(h.toLowerCase()));
          if (next.length !== hidden.length) {
            user.hiddenSymptoms = next;
            await user.save();
          }
        }
      }
    } catch (unhideErr) {
      console.error("Un-hide symptom error:", unhideErr);
    }

    // 201 means something was created successfully
    res.status(201).json({
      message: "Check-in created successfully",
      checkIn,
    });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ error: "Server error during check-in" });
  }
};

// getCheckIns handles GET /api/checkins
// returns all check-ins for the logged in user, newest first
const getCheckIns = async (req, res) => {
  try {
    // ownership filter — users only ever see their own data
    const where = { userId: req.user.id };

    // optional YYYY-MM-DD range on the `date` column; anything malformed is
    // ignored rather than 400'd so a bad query param never breaks the dashboard
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    let hasDateFilter = false;
    if (typeof startDate === "string" && dateRe.test(startDate)) {
      dateFilter[Op.gte] = startDate;
      hasDateFilter = true;
    }
    if (typeof endDate === "string" && dateRe.test(endDate)) {
      dateFilter[Op.lte] = endDate;
      hasDateFilter = true;
    }
    // Op.gte/Op.lte are Symbol keys, so Object.keys can't see them — track a flag
    if (hasDateFilter) where.date = dateFilter;

    // hard server cap of 1000 rows no matter what's requested — at a check-in or
    // two a day that's ~2 years, plenty for streaks and milestones
    const MAX_LIMIT = 1000;
    let limit = MAX_LIMIT;
    const requested = parseInt(req.query.limit, 10);
    if (Number.isInteger(requested) && requested > 0) limit = Math.min(requested, MAX_LIMIT);

    // ordering by createdAt DESC means the most recent check-in comes back first
    const checkIns = await CheckIn.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
    });

    res.status(200).json({ checkIns });
  } catch (error) {
    console.error("Error getting check-ins", error);
    res.status(500).json({ error: "Server error processing check-ins" });
  }
};

// updateCheckIn handles PUT /api/checkins/:id
// lets a user correct a check-in they already submitted
const updateCheckIn = async (req, res) => {
  try {
    // the check-in id comes from the URL - e.g. /api/checkins/5
    const { id } = req.params;

    // find the check-in and make sure it belongs to the logged in user
    // if we just searched by id, any logged in user could edit anyone else's check-ins
    const checkIn = await CheckIn.findOne({
      where: {
        id: id,
        userId: req.user.id,
      },
    });

    // if we can't find it, either it doesn't exist or it belongs to someone else
    // either way we return 404 - we don't tell them which one for security reasons
    if (!checkIn) {
      return res.status(404).json({ error: "Check-in not found" });
    }

    // grab whatever fields the user wants to update from the request body
    const { painLevel, moodLevel, energyLevel, anxietyLevel, appetiteLevel, symptoms, followUpData } = req.body;

    await checkIn.update({
      painLevel: painLevel || checkIn.painLevel,
      moodLevel: moodLevel || checkIn.moodLevel,
      energyLevel: energyLevel !== undefined ? energyLevel : checkIn.energyLevel,
      anxietyLevel: anxietyLevel !== undefined ? anxietyLevel : checkIn.anxietyLevel,
      appetiteLevel: appetiteLevel !== undefined ? appetiteLevel : checkIn.appetiteLevel,
      symptoms: symptoms !== undefined ? symptoms : checkIn.symptoms,
      followUpData: followUpData || checkIn.followUpData,
    });

    // Sequelize automatically updates the checkIn object after update()
    // so we can just send it back directly
    res.status(200).json({
      message: "Check-in updated successfully",
      checkIn,
    });
  } catch (error) {
    console.error("Error updating check-in", error);
    res.status(500).json({ error: "Server cannot update check-in" });
  }
};

const deleteCheckIn = async (req, res) => {
  try {
    // get the check-in id from the URL
    const { id } = req.params;

    // find the check-in and verify it belongs to the logged in user
    const checkIn = await CheckIn.findOne({
      where: {
        id: id,
        userId: req.user.id,
      },
    });

    // if we can't find it, return 404
    if (!checkIn) {
      return res.status(404).json({ error: "Check-in not found" });
    }

    // destroy() permanently deletes the record from the database
    await checkIn.destroy();

    res.status(200).json({ message: "Check-in deleted successfully" });
  } catch (error) {
    console.error("Error deleting check-in", error);
    res.status(500).json({ error: "Server error deleting check-in" });
  }
};

// getMySymptoms handles GET /api/checkins/symptoms
// aggregates the symptoms this user has logged across their recent check-ins so
// the check-in flow can surface a personal "your symptoms" list, most-recent first
const getMySymptoms = async (req, res) => {
  try {
    const [rows, user] = await Promise.all([
      CheckIn.findAll({
        attributes: ["symptoms", "createdAt"],
        where: { userId: req.user.id },
        order: [["createdAt", "DESC"]],
        limit: 200,
        raw: true,
      }),
      User.findByPk(req.user.id),
    ]);
    const hiddenSet = new Set(
      (Array.isArray(user?.hiddenSymptoms) ? user.hiddenSymptoms : []).map((h) =>
        h.toLowerCase(),
      ),
    );
    const agg = {};
    for (const r of rows) {
      const list = Array.isArray(r.symptoms) ? r.symptoms : [];
      for (const s of list) {
        if (hiddenSet.has(s.toLowerCase())) continue; // hidden from suggestions
        if (!agg[s]) agg[s] = { name: s, count: 0, lastUsed: r.createdAt };
        agg[s].count += 1;
      }
    }
    res.json(Object.values(agg).sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed)));
  } catch (err) {
    console.error("Get symptoms error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// hideSymptom handles POST /api/checkins/symptoms/hide
// removes a name from the user's personal suggestions; history is untouched
const hideSymptom = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 40) return res.status(400).json({ error: "Invalid symptom name" });
    const user = await User.findByPk(req.user.id);
    const hidden = Array.isArray(user.hiddenSymptoms) ? user.hiddenSymptoms : [];
    if (!hidden.some((h) => h.toLowerCase() === name.toLowerCase())) {
      user.hiddenSymptoms = [...hidden, name];
      await user.save();
    }
    res.json({ hiddenSymptoms: user.hiddenSymptoms });
  } catch (err) {
    console.error("Hide symptom error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { createCheckIn, getCheckIns, updateCheckIn, deleteCheckIn, getMySymptoms, hideSymptom };
