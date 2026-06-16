const crypto = require("crypto");
const { Resend } = require("resend");
const User = require("../models/User");

const resend = new Resend(process.env.RESEND_API_KEY);

const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;

    const user = await User.findOne({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const emailChanging = email && email !== user.email;

    if (emailChanging) {
      const existing = await User.findOne({ where: { email } });
      if (existing)
        return res.status(400).json({ error: "Email already in use" });

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

      await User.update(
        { username, pendingEmail: email, verificationToken },
        { where: { id: user.id } },
      );

      await resend.emails.send({
        from: "Chronically <noreply@mychronically.app>",
        to: email,
        subject: "Verify your new Chronically email",
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2D2540; font-family: Georgia, serif;">Confirm your new email</h2>
            <p style="color: #6B5F7A;">Click the button below to confirm <strong>${email}</strong> as your new Chronically email address.</p>
            <a href="${verifyUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #7C6BAE; color: white; border-radius: 999px; text-decoration: none; font-size: 14px;">Confirm Email</a>
            <p style="color: #6B5F7A; font-size: 12px; margin-top: 24px;">If you didn't request this change, you can safely ignore this email.</p>
          </div>
        `,
      });

      return res.status(200).json({
        message: `A verification link has been sent to ${email}. Your email will update once confirmed.`,
        emailPending: true,
        user: { id: user.id, username, email: user.email, avatar: user.avatar || null },
      });
    }

    await User.update({ username }, { where: { id: user.id } });

    res.status(200).json({
      message: "Profile updated successfully",
      user: { id: user.id, username, email: user.email, avatar: user.avatar || null },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Server error updating profile" });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await user.destroy();
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Server error deleting account" });
  }
};

const MAX_AVATAR_LENGTH = 400000;

const updateAvatar = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image data" });
    }
    if (image.length > MAX_AVATAR_LENGTH) {
      return res.status(400).json({ error: "Image is too large. Please try a smaller photo." });
    }
    await User.update({ avatar: image }, { where: { id: req.user.id } });
    res.status(200).json({ avatar: image });
  } catch (error) {
    console.error("Update avatar error:", error);
    res.status(500).json({ error: "Server error updating avatar" });
  }
};

const deleteAvatar = async (req, res) => {
  try {
    await User.update({ avatar: null }, { where: { id: req.user.id } });
    res.status(200).json({ message: "Avatar removed" });
  } catch (error) {
    console.error("Delete avatar error:", error);
    res.status(500).json({ error: "Server error removing avatar" });
  }
};

module.exports = { updateProfile, deleteAccount, updateAvatar, deleteAvatar };
