import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import Navigation, { NavHamburger } from "../components/Navigation";
import HomeLogo from "../components/HomeLogo";
import FormModal, { ModalFooter, ConfirmDialog, labelClass } from "../components/FormModal";
import AnnouncementCard from "../components/AnnouncementCard";

const EMPTY_FORM = { id: null, title: "", body: "", publishNow: false, expiresAt: "" };

// Draft → never published. Live → published and not past its expiry.
// Expired → was live, expiry has passed.
const statusOf = (a) => {
  if (!a.publishedAt) return "Draft";
  if (new Date(a.publishedAt) > new Date()) return "Scheduled";
  if (a.expiresAt && new Date(a.expiresAt) <= new Date()) return "Expired";
  return "Live";
};

const STATUS_COLORS = {
  Draft:     { background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)" },
  Scheduled: { background: "rgba(255,255,255,0.2)",  color: "white" },
  Live:      { background: "rgba(255,255,255,0.9)",  color: "#5A3A60" },
  Expired:   { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// <input type="datetime-local"> wants local wall time, not an ISO instant
const toLocalInput = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

function AdminAnnouncementsPage() {
  const { token } = useAuth();
  const base = import.meta.env.VITE_API_URL;
  const headers = { Authorization: `Bearer ${token}` };

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${base}/api/admin/announcements`, { headers });
      setAnnouncements(res.data.announcements || []);
      setLoadError("");
    } catch (err) {
      setLoadError(
        err.response?.status === 403
          ? "This account doesn't have admin access."
          : "Could not load announcements.",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setSaveError("");
    setShowModal(true);
  };

  const openEdit = (a) => {
    setForm({
      id: a.id,
      title: a.title,
      body: a.body,
      // editing never changes publish state on its own — Publish is its own action
      publishNow: false,
      expiresAt: toLocalInput(a.expiresAt),
    });
    setSaveError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };
      // only send publishedAt when creating-and-publishing; omitting the key
      // leaves an existing announcement's publish state exactly as it was
      if (!form.id && form.publishNow) payload.publishedAt = new Date().toISOString();

      if (form.id) {
        await axios.put(`${base}/api/admin/announcements/${form.id}`, payload, { headers });
      } else {
        await axios.post(`${base}/api/admin/announcements`, payload, { headers });
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Publishing and unpublishing are explicit, one-click, and never bundled into
  // a save — so nobody makes a wording tweak and accidentally goes live.
  const setPublished = async (a, publish) => {
    setBusyId(a.id);
    try {
      await axios.put(
        `${base}/api/admin/announcements/${a.id}`,
        {
          title: a.title,
          body: a.body,
          publishedAt: publish ? new Date().toISOString() : null,
        },
        { headers },
      );
      await load();
    } catch {
      setLoadError("Could not change publish state.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${base}/api/admin/announcements/${confirmDelete.id}`, { headers });
      setConfirmDelete(null);
      await load();
    } catch {
      setLoadError("Could not delete.");
    } finally {
      setDeleting(false);
    }
  };

  const canSave = form.title.trim().length > 0 && form.body.trim().length > 0;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#5C4E8A" }}>
      <div
        className="absolute rounded-full opacity-20"
        style={{ width: 300, height: 300, background: "#DEC8DA", filter: "blur(80px)", top: -60, right: -80, pointerEvents: "none" }}
      />

      <div className="relative z-20">
        <div className="px-6 py-4 flex justify-between items-center" style={{ maxWidth: 1024, margin: "0 auto" }}>
          <div className="flex items-center gap-2.5">
            <HomeLogo />
            <h1 className="text-white font-medium text-lg" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
              Announcements
            </h1>
          </div>
          <NavHamburger />
        </div>
      </div>

      <div className="relative z-10 p-6 pb-24 flex flex-col gap-4" style={{ maxWidth: 1024, margin: "0 auto" }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            Updates from Chronicle, shown on the dashboard one at a time.
          </p>
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all hover:opacity-90 flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)", color: "white" }}
          >
            <FiPlus size={15} />
            New
          </button>
        </div>

        {loadError && (
          <div className="p-4 rounded-2xl" style={{ background: "rgba(176,112,136,0.2)", border: "1px solid rgba(176,112,136,0.35)" }}>
            <p className="text-sm" style={{ color: "white" }}>{loadError}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm py-10 text-center" style={{ color: "rgba(255,255,255,0.7)" }}>Loading…</p>
        ) : announcements.length === 0 ? (
          <div className="p-6 rounded-2xl text-center" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              Nothing yet. Write the first update.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                    {["Title", "Status", "Published", "Read", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs uppercase tracking-[0.08em] font-medium"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((a) => {
                    const status = statusOf(a);
                    return (
                      <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        <td className="px-4 py-3 text-sm" style={{ color: "white", maxWidth: 280 }}>
                          {a.title}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={STATUS_COLORS[status]}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                          {fmtDate(a.publishedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                          {a.readCount}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPublished(a, status === "Draft" || status === "Expired")}
                              disabled={busyId === a.id}
                              className="px-3 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                              style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                            >
                              {status === "Draft" || status === "Expired" ? "Publish" : "Unpublish"}
                            </button>
                            <button
                              onClick={() => openEdit(a)}
                              aria-label={`Edit ${a.title}`}
                              className="p-2 rounded-full transition-opacity hover:opacity-70"
                              style={{ color: "rgba(255,255,255,0.8)" }}
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(a)}
                              aria-label={`Delete ${a.title}`}
                              className="p-2 rounded-full transition-opacity hover:opacity-70"
                              style={{ color: "rgba(255,255,255,0.8)" }}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <FormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit announcement" : "New announcement"}
        subtitle="Shown on the dashboard, in Chronicle's voice."
        footer={
          <ModalFooter
            onCancel={() => setShowModal(false)}
            onSave={handleSave}
            saveLabel={form.id ? "Save" : form.publishNow ? "Create & publish" : "Save draft"}
            saving={saving}
            canSave={canSave}
            error={saveError}
          />
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          <div>
            <label className={labelClass} htmlFor="ann-title">Title</label>
            <input
              id="ann-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={120}
              placeholder="Insights have arrived"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "white" }}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="ann-body">Body</label>
            <textarea
              id="ann-body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              maxLength={2000}
              rows={7}
              placeholder="Trends can now spot patterns in your own data…"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "white" }}
            />
            <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
              Chronicle speaks like the app does — warm, brief, never salesy. No urgency, no pressure.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="ann-expires">Expires (optional)</label>
            <input
              id="ann-expires"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "white" }}
            />
            <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
              Leave empty to show until dismissed.
            </p>
          </div>

          {!form.id && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.publishNow}
                onChange={(e) => setForm({ ...form, publishNow: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>
                Publish immediately
              </span>
            </label>
          )}

          {/* Live preview — the same component the dashboard renders, so what's
              here is exactly what users will see */}
          <div>
            <p className={labelClass}>Preview</p>
            <div className="rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.18)" }}>
              <AnnouncementCard
                preview
                announcement={{
                  id: "preview",
                  title: form.title.trim() || "Your title",
                  body: form.body.trim() || "Chronicle's message will appear here.",
                }}
              />
            </div>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Delete this announcement?"
        message={
          confirmDelete
            ? `"${confirmDelete.title}" and its ${confirmDelete.readCount} dismissal${confirmDelete.readCount === 1 ? "" : "s"} will be removed. This can't be undone.`
            : ""
        }
      />

      <Navigation />
    </div>
  );
}

export default AdminAnnouncementsPage;
