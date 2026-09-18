const { Op, fn, col } = require("sequelize");
const Announcement = require("../models/Announcement");
const AnnouncementRead = require("../models/AnnouncementRead");

const MAX_TITLE = 120;
const MAX_BODY = 2000;

// Shared validation for create and update. Returns an error string or null.
const validateFields = ({ title, body }) => {
  if (typeof title !== "string" || !title.trim()) return "Title is required";
  if (title.trim().length > MAX_TITLE) return `Title must be ${MAX_TITLE} characters or fewer`;
  if (typeof body !== "string" || !body.trim()) return "Body is required";
  if (body.trim().length > MAX_BODY) return `Body must be ${MAX_BODY} characters or fewer`;
  return null;
};

// A date field that may be explicitly cleared. Returns { value } or { error }.
const parseDate = (value, label) => {
  if (value === null || value === undefined || value === "") return { value: null };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { error: `${label} is not a valid date` };
  return { value: d };
};

// ── User-facing ─────────────────────────────────────────────────────────────

// getCurrentAnnouncement handles GET /api/announcements
// Returns the single most recent live announcement this user hasn't dismissed,
// or null. One at a time on purpose — a queue of stacked cards is noise, and a
// dashboard is not an inbox.
const getCurrentAnnouncement = async (req, res) => {
  try {
    const now = new Date();

    const dismissed = await AnnouncementRead.findAll({
      where: { userId: req.user.id },
      attributes: ["announcementId"],
      raw: true,
    });
    const dismissedIds = dismissed.map((d) => d.announcementId);

    const where = {
      publishedAt: { [Op.ne]: null, [Op.lte]: now },
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
    };
    if (dismissedIds.length > 0) where.id = { [Op.notIn]: dismissedIds };

    const announcement = await Announcement.findOne({
      where,
      attributes: ["id", "title", "body", "publishedAt"],
      order: [["publishedAt", "DESC"]],
    });

    res.json({ announcement: announcement || null });
  } catch (error) {
    console.error("Get announcement error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// dismissAnnouncement handles POST /api/announcements/:id/dismiss
// Idempotent: dismissing twice is a no-op rather than an error, so a retry or a
// double tap can't fail in the user's face.
const dismissAnnouncement = async (req, res) => {
  try {
    const announcementId = Number(req.params.id);
    if (!Number.isInteger(announcementId)) {
      return res.status(400).json({ error: "Invalid announcement id" });
    }

    const announcement = await Announcement.findByPk(announcementId);
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });

    await AnnouncementRead.findOrCreate({
      where: { userId: req.user.id, announcementId },
      defaults: { userId: req.user.id, announcementId, dismissedAt: new Date() },
    });

    res.json({ message: "Dismissed" });
  } catch (error) {
    console.error("Dismiss announcement error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ── Admin ───────────────────────────────────────────────────────────────────

// listAnnouncements handles GET /api/admin/announcements — drafts included,
// each with the number of users who have dismissed it.
const listAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.findAll({
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    const counts = await AnnouncementRead.findAll({
      attributes: ["announcementId", [fn("COUNT", col("id")), "count"]],
      group: ["announcementId"],
      raw: true,
    });
    const byId = new Map(counts.map((c) => [c.announcementId, Number(c.count)]));

    res.json({
      announcements: announcements.map((a) => ({ ...a, readCount: byId.get(a.id) || 0 })),
    });
  } catch (error) {
    console.error("List announcements error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// createAnnouncement handles POST /api/admin/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { title, body, publishedAt, expiresAt } = req.body;

    const fieldError = validateFields({ title, body });
    if (fieldError) return res.status(400).json({ error: fieldError });

    const published = parseDate(publishedAt, "Publish date");
    if (published.error) return res.status(400).json({ error: published.error });
    const expires = parseDate(expiresAt, "Expiry date");
    if (expires.error) return res.status(400).json({ error: expires.error });

    const announcement = await Announcement.create({
      title: title.trim(),
      body: body.trim(),
      publishedAt: published.value,
      expiresAt: expires.value,
      createdBy: req.user.id,
    });

    res.status(201).json({ announcement: { ...announcement.toJSON(), readCount: 0 } });
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// updateAnnouncement handles PUT /api/admin/announcements/:id
// publishedAt and expiresAt are only touched when the key is present, so
// editing a live announcement's wording can't silently unpublish it.
const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });

    const { title, body, publishedAt, expiresAt } = req.body;

    const fieldError = validateFields({ title, body });
    if (fieldError) return res.status(400).json({ error: fieldError });

    const patch = { title: title.trim(), body: body.trim() };

    if ("publishedAt" in req.body) {
      const published = parseDate(publishedAt, "Publish date");
      if (published.error) return res.status(400).json({ error: published.error });
      patch.publishedAt = published.value;
    }
    if ("expiresAt" in req.body) {
      const expires = parseDate(expiresAt, "Expiry date");
      if (expires.error) return res.status(400).json({ error: expires.error });
      patch.expiresAt = expires.value;
    }

    await announcement.update(patch);

    const readCount = await AnnouncementRead.count({ where: { announcementId: announcement.id } });
    res.json({ announcement: { ...announcement.toJSON(), readCount } });
  } catch (error) {
    console.error("Update announcement error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// deleteAnnouncement handles DELETE /api/admin/announcements/:id
// The read rows go with it via the association's CASCADE.
const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });

    await announcement.destroy();
    res.json({ message: "Announcement deleted" });
  } catch (error) {
    console.error("Delete announcement error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getCurrentAnnouncement,
  dismissAnnouncement,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
