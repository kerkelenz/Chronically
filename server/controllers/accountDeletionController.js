const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
const SUPPORT_EMAIL = "kevin@erkelenz.tech";

const requestAccountDeletion = async (req, res) => {
  try {
    const { email, reason, website } = req.body;
    // honeypot: bots fill hidden "website" field — silently accept, don't email
    if (website) return res.status(200).json({ message: "Request received" });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "A valid account email is required." });
    }
    const safeEmail = String(email).slice(0, 200).replace(/</g, "&lt;");
    const safeReason = String(reason || "").slice(0, 2000).replace(/</g, "&lt;") || "(none provided)";
    await resend.emails.send({
      from: "Chronically <noreply@mychronically.app>",
      to: SUPPORT_EMAIL,
      replyTo: email,
      subject: `[Chronically] Account deletion request — ${safeEmail}`,
      html: `
        <h2 style="font-family:sans-serif">Account deletion request</h2>
        <p style="font-family:sans-serif"><strong>Account email:</strong> ${safeEmail}</p>
        <p style="font-family:sans-serif"><strong>Reason:</strong></p>
        <p style="font-family:sans-serif;white-space:pre-wrap">${safeReason}</p>
        <hr/>
        <p style="font-family:sans-serif">Verify the requester owns this account, then delete it and all associated data.</p>
      `,
    });
    res.status(200).json({ message: "Request received" });
  } catch (err) {
    console.error("Deletion request error:", err);
    res.status(500).json({ error: "Could not submit your request. Please email privacy@mychronically.app." });
  }
};

module.exports = { requestAccountDeletion };
