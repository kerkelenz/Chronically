const User = require("../models/User");

const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;

    const user = await User.findOne({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({ username, email });

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Server error updating profile" });
  }
};

module.exports = { updateProfile };
