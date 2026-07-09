const Event = require("../models/Event");

// deliberate whitelist — one event per meaningful action, nothing screen-by-screen
const ALLOWED = new Set([
  "session_start",
  "checkin_completed",
  "medication_logged",
  "report_exported",
  "feedback_sent",
  "welcome_completed",
  "spoon_day_planned",
]);

const MAX_BATCH = 20;

// clients batch events locally and POST them here in one request
const ingestEvents = async (req, res) => {
  try {
    const { events, platform, appVersion } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "events array required" });
    }
    const rows = [];
    for (const e of events.slice(0, MAX_BATCH)) {
      if (!e || !ALLOWED.has(e.name)) continue; // silently drop unknown names
      let metadata = null;
      if (e.metadata && typeof e.metadata === "object") {
        const s = JSON.stringify(e.metadata);
        if (s.length <= 1024) metadata = e.metadata; // cap metadata size
      }
      const when = e.occurredAt ? new Date(e.occurredAt) : new Date();
      rows.push({
        userId: req.user.id,
        name: e.name,
        platform: typeof platform === "string" ? platform.slice(0, 20) : null,
        appVersion: typeof appVersion === "string" ? appVersion.slice(0, 20) : null,
        metadata,
        occurredAt: isNaN(when) ? new Date() : when,
      });
    }
    if (rows.length) await Event.bulkCreate(rows);
    res.status(200).json({ accepted: rows.length });
  } catch (err) {
    console.error("Event ingest error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { ingestEvents };
