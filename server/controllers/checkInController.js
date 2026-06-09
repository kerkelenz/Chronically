const CheckIn = require("../models/CheckIn");

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
    // findAll with a where clause so users only ever see their own data
    // ordering by date DESC means the most recent check-in comes back first
    const checkIns = await CheckIn.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]],
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

module.exports = { createCheckIn, getCheckIns, updateCheckIn, deleteCheckIn };
