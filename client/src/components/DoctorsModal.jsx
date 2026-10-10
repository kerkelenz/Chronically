import { useState } from "react";
import axios from "axios";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import FormModal, { ModalFooter, labelClass, ConfirmDialog } from "./FormModal";
import { describeDoctor } from "../utils/doctorHelpers";

const API = import.meta.env.VITE_API_URL;
const PRIMARY = "#7C6BAE";

const inputStyle = {
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.3)",
  color: "white",
};

const EMPTY = { name: "", specialty: "", location: "" };

/**
 * Manages the saved list: rename, correct a specialty, remove someone, or add a
 * doctor without booking anything. The web twin of mobile/components/
 * DoctorsSheet.jsx.
 *
 * Only `saved: true` entries appear. The picker also suggests doctors found in
 * past appointments, but those are not rows the user can edit or delete —
 * they're derived from history, and the only way to change them is to change
 * the appointment.
 *
 * Removing a doctor here never touches an appointment, which is what the
 * confirmation says in as many words.
 */
export default function DoctorsModal({ open, onClose, doctors, token, onChanged }) {
  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const hdrs = { Authorization: `Bearer ${token}` };

  // alphabetical here rather than by recency: this is a list to find someone in,
  // not a shortcut ordered by likelihood
  const saved = (Array.isArray(doctors) ? doctors : [])
    .filter((d) => d.saved)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const backToList = () => {
    setMode("list");
    setEditingId(null);
    setForm(EMPTY);
    setError("");
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError("");
    setMode("form");
  };

  const openEdit = (doctor) => {
    setEditingId(doctor.id);
    setForm({
      name: doctor.name || "",
      specialty: doctor.specialty || "",
      location: doctor.location || "",
    });
    setError("");
    setMode("form");
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await axios.put(`${API}/api/doctors/${editingId}`, form, { headers: hdrs });
      } else {
        await axios.post(`${API}/api/doctors`, form, { headers: hdrs });
      }
      await onChanged?.();
      backToList();
    } catch (err) {
      // the server's own words for a name clash; anything else stays generic
      setError(err?.response?.data?.error || "Could not save that doctor.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError("");
    try {
      await axios.delete(`${API}/api/doctors/${removing.id}`, { headers: hdrs });
      await onChanged?.();
      setRemoving(null);
    } catch (err) {
      setRemoveError(err?.response?.data?.error || "Could not remove that doctor.");
    } finally {
      setRemoveBusy(false);
    }
  };

  const closeAll = () => {
    backToList();
    onClose?.();
  };

  return (
    <>
      <FormModal
        open={open}
        onClose={closeAll}
        title={mode === "form" ? (editingId ? "Edit doctor" : "Add doctor") : "My doctors"}
        footer={
          mode === "form" ? (
            <ModalFooter
              onCancel={backToList}
              onSave={handleSave}
              saving={saving}
              canSave={!!form.name.trim()}
              error={error}
            />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={closeAll}
                className="px-4 py-2.5 rounded-full text-sm text-white/70 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "white", color: PRIMARY }}
              >
                Add doctor
              </button>
            </div>
          )
        }
      >
        {mode === "form" ? (
          <div className="flex flex-col gap-3 pb-1">
            <div>
              <label htmlFor="doctors-doctor-name" className={labelClass}>Doctor name *</label>
              <input id="doctors-doctor-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Dr. Smith"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="doctors-specialty" className={labelClass}>Specialty</label>
              <input id="doctors-specialty"
                type="text"
                value={form.specialty}
                onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                placeholder="Neurology"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="doctors-location" className={labelClass}>Location</label>
              <input id="doctors-location"
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Hospital or clinic name"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none placeholder-white/30"
                style={inputStyle}
              />
            </div>
          </div>
        ) : saved.length === 0 ? (
          <p className="text-sm text-white/65 py-2">
            Doctors you save show up here, and when you add an appointment.
          </p>
        ) : (
          <div className="flex flex-col gap-2 pb-1">
            {saved.map((doctor) => {
              const detail = describeDoctor(doctor);
              return (
                <div
                  key={doctor.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    minHeight: 44,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{doctor.name}</p>
                    {detail ? (
                      <p className="text-xs text-white/60 truncate">{detail}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(doctor)}
                    aria-label={`Edit ${doctor.name}`}
                    className="w-11 h-11 flex items-center justify-center flex-shrink-0 text-white/60 hover:text-white transition-colors"
                  >
                    <FiEdit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRemoving(doctor); setRemoveError(""); }}
                    aria-label={`Remove ${doctor.name}`}
                    className="w-11 h-11 flex items-center justify-center flex-shrink-0 text-white/60 hover:text-white transition-colors"
                  >
                    <FiTrash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </FormModal>

      <ConfirmDialog
        open={!!removing}
        onCancel={() => setRemoving(null)}
        onConfirm={handleRemove}
        title={removing ? `Remove ${removing.name}?` : ""}
        message="This only removes them from your saved list. Appointments you've already added aren't changed."
        confirmLabel="Remove"
        cancelLabel="Keep"
        busy={removeBusy}
        error={removeError}
      />
    </>
  );
}
