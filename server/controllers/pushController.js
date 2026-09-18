const { Expo } = require("expo-server-sdk");
const PushToken = require("../models/PushToken");

// registerPushToken handles POST /api/push/register
// Upserts on the token itself, not on (userId, token): a token identifies a
// device, and if someone signs into a shared phone the row must move to the new
// account rather than leaving the previous owner receiving that device's pushes.
const registerPushToken = async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token || !Expo.isExpoPushToken(token)) {
      return res.status(400).json({ error: "A valid Expo push token is required" });
    }
    if (platform !== "ios" && platform !== "android") {
      return res.status(400).json({ error: "Platform must be ios or android" });
    }

    const existing = await PushToken.findOne({ where: { token } });
    if (existing) {
      await existing.update({ userId: req.user.id, platform });
      return res.json({ pushToken: { id: existing.id, platform } });
    }

    const created = await PushToken.create({ userId: req.user.id, token, platform });
    res.status(201).json({ pushToken: { id: created.id, platform } });
  } catch (error) {
    console.error("Register push token error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// unregisterPushToken handles DELETE /api/push/register — called on sign-out.
// Scoped to the caller's own rows so a stale token string can never be used to
// unregister somebody else's device.
const unregisterPushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    await PushToken.destroy({ where: { token, userId: req.user.id } });
    res.json({ message: "Push token removed" });
  } catch (error) {
    console.error("Unregister push token error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { registerPushToken, unregisterPushToken };
