const { Resend } = require("resend");
const User = require("../models/User");

const resend = new Resend(process.env.RESEND_API_KEY);
const SUPPORT_EMAIL = "kevin@erkelenz.tech";

const submitFeedback = async (req, res) => {
  try {
    const { message, category, platform, appVersion } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const user = await User.findByPk(req.user.id);
    const userEmail = user?.email || "unknown";
    const userName = user?.username || "unknown";
    const cat = category || "Other";
    const safe = String(message).slice(0, 5000).replace(/</g, "&lt;");

    await resend.emails.send({
      from: "Chronically <noreply@mychronically.app>",
      to: SUPPORT_EMAIL,
      replyTo: userEmail,
      subject: `[Chronically] ${cat} report from ${userName}`,
      html: `
        <h2 style="font-family:sans-serif">New ${cat} report</h2>
        <p style="font-family:sans-serif"><strong>From:</strong> ${userName} (${userEmail})</p>
        <p style="font-family:sans-serif"><strong>Platform:</strong> ${platform || "unknown"}${appVersion ? " · v" + appVersion : ""}</p>
        <hr/>
        <p style="font-family:sans-serif;white-space:pre-wrap">${safe}</p>
      `,
    });

    res.status(200).json({ message: "Feedback sent" });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "Could not send feedback" });
  }
};

module.exports = { submitFeedback };
