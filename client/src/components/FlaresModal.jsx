import { useState } from "react";
import axios from "axios";
import FormModal, { ModalFooter, labelClass, ConfirmDialog, PLUM, SOFT_ERROR } from "./FormModal";
import { formatFlareRange, localToday } from "../utils/flareHelpers";

const API = import.meta.env.VITE_API_URL;
const PRIMARY = "#7C6BAE";
const NOTE_MAX = 280;
const NOTE_COUNTER_FROM = 240;

const inputStyle = {
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.3)",
  color: "white",
};

/**
 * Every flare form in one place, because they are the same three fields in
 * different combinations and the server's validation messages have to surface
 * identically whichever one you came from:
 *
 *  - "start": the dashboard's Having a flare? → Started + Note
 *  - "ease":  the ongoing card's It's eased  → Ended
 *  - "list":  Trends → Your flares           → the history, and from it the
 *             full editor (Started, Ended, Still going, Note) and Add a past flare
 *
 * The mobile twin is mobile/components/FlaresSheet.jsx.
 */
export default function FlaresModal({
  open, onClose, mode = "list", flare = null, flares = [], token, onChanged,
}) {
  const today = localToday();
  const hdrs = { Authorization: `Bearer ${token}` };

  // "list" | "start" | "ease" | "edit" | "add"
  const [view, setView] = useState(mode);
  const [form, setForm] = useState(() => seed(mode, flare, today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");

  // the modal is mounted fresh each time it opens, so `mode` only has to seed
  const openForm = (nextView, target) => {
    setForm(seed(nextView, target, today));
    setError("");
    setView(nextView);
  };

  const closeAll = () => { setError(""); onClose?.(); };
  const backToList = () => { setError(""); setView("list"); };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const body = {};
      if (view === "ease") {
        body.endDate = form.endDate;
      } else {
        body.startDate = form.startDate;
        body.note = form.note;
        // "Still going" is the only way to say "no end" — an empty date field
        // on its own would be ambiguous with "I haven't filled this in yet"
        if (view !== "start") body.endDate = form.stillGoing ? null : form.endDate;
      }

      if (view === "start" || view === "add") {
        await axios.post(`${API}/api/flares`, body, { headers: hdrs });
      } else {
        await axios.put(`${API}/api/flares/${form.id}`, body, { headers: hdrs });
      }
      await onChanged?.();
      // the dashboard forms are one-shot; the list keeps you where you were
      if (view === "start" || view === "ease") closeAll();
      else backToList();
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing || removeBusy) return;
    setRemoveBusy(true);
    setRemoveError("");
    try {
      await axios.delete(`${API}/api/flares/${removing.id}`, { headers: hdrs });
      await onChanged?.();
      setRemoving(null);
    } catch (err) {
      setRemoveError(err?.response?.data?.error || "Couldn't remove that. Please try again.");
    } finally {
      setRemoveBusy(false);
    }
  };

  const titles = {
    list: "Your flares",
    start: "Start a flare",
    ease: "Glad it's easing",
    edit: "Edit flare",
    add: "Add a past flare",
  };
  const subtitles = {
    start: "Mark the day it began. You can end it whenever it eases.",
  };

  const canSave = view === "ease"
    ? !!form.endDate
    : !!form.startDate && (view === "start" || form.stillGoing || !!form.endDate);

  const noteField = (
    <div>
      <label htmlFor="flare-note" className={labelClass}>Note</label>
      <textarea
        id="flare-note"
        rows={2}
        maxLength={NOTE_MAX}
        value={form.note}
        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        placeholder="Anything you want to remember about it"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none placeholder-white/40"
        style={inputStyle}
      />
      {form.note.length >= NOTE_COUNTER_FROM && (
        <p className="text-[11px] text-right mt-1 text-white/60" aria-live="polite">
          {form.note.length}/{NOTE_MAX}
        </p>
      )}
    </div>
  );

  const dateField = (id, label, value, onChange, { min, max } = {}) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ ...inputStyle, colorScheme: "dark" }}
      />
    </div>
  );

  return (
    <>
      <FormModal
        open={open}
        onClose={closeAll}
        title={titles[view]}
        subtitle={subtitles[view]}
        footer={
          view === "list" ? (
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
                onClick={() => openForm("add", null)}
                className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "white", color: PRIMARY }}
              >
                Add a past flare
              </button>
            </div>
          ) : (
            <ModalFooter
              onCancel={mode === "list" ? backToList : closeAll}
              onSave={save}
              saveLabel={view === "start" ? "Start" : "Save"}
              saving={saving}
              canSave={canSave}
              error={error}
            />
          )
        }
      >
        {view === "list" ? (
          flares.length === 0 ? (
            <p className="text-sm text-white/65 py-2">
              When you mark a flare from Home, it shows up here.
            </p>
          ) : (
            <div className="flex flex-col gap-2 pb-1">
              {flares.map((f) => (
                <div
                  key={f.id}
                  className="px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
                >
                  <p className="text-sm text-white">{formatFlareRange(f, today)}</p>
                  {f.note ? (
                    <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{f.note}</p>
                  ) : null}
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => openForm("edit", f)}
                      className="text-xs text-white/70 hover:text-white transition-colors min-h-[44px] px-3 -ml-3"
                      aria-label={`Edit flare ${formatFlareRange(f, today)}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRemoveError(""); setRemoving(f); }}
                      className="text-xs text-white/70 hover:text-white transition-colors min-h-[44px] px-3"
                      aria-label={`Remove flare ${formatFlareRange(f, today)}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3 pb-1">
            {view === "ease" ? (
              dateField("flare-end", "Ended", form.endDate,
                (v) => setForm((f) => ({ ...f, endDate: v })),
                { min: form.startDate, max: today })
            ) : (
              <>
                {dateField("flare-start", "Started", form.startDate,
                  (v) => setForm((f) => ({ ...f, startDate: v })), { max: today })}

                {view !== "start" && (
                  <>
                    <label
                      htmlFor="flare-still-going"
                      className="flex items-center gap-2.5 cursor-pointer"
                      style={{ minHeight: 44 }}
                    >
                      <input
                        id="flare-still-going"
                        type="checkbox"
                        checked={form.stillGoing}
                        onChange={(e) => setForm((f) => ({ ...f, stillGoing: e.target.checked }))}
                        className="w-4 h-4 flex-shrink-0 accent-white cursor-pointer"
                      />
                      <span className="text-sm text-white/80">Still going</span>
                    </label>
                    {!form.stillGoing && dateField("flare-end", "Ended", form.endDate,
                      (v) => setForm((f) => ({ ...f, endDate: v })),
                      { min: form.startDate, max: today })}
                  </>
                )}

                {noteField}
              </>
            )}
          </div>
        )}
      </FormModal>

      <ConfirmDialog
        open={!!removing}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
        title="Remove this flare?"
        message="This only removes the dates you marked. Your check-ins aren't changed."
        confirmLabel="Remove"
        cancelLabel="Keep"
        busy={removeBusy}
        error={removeError}
      />
    </>
  );
}

// `stillGoing` carries what an empty date field cannot: the difference between
// "this flare has no end" and "I haven't typed the end yet".
function seed(view, flare, today) {
  if (view === "ease") {
    return {
      id: flare?.id,
      startDate: flare?.startDate || today,
      endDate: today,
      note: flare?.note || "",
      stillGoing: false,
    };
  }
  if (view === "edit" && flare) {
    return {
      id: flare.id,
      startDate: flare.startDate,
      endDate: flare.endDate || today,
      note: flare.note || "",
      stillGoing: !flare.endDate,
    };
  }
  // start, add
  return { id: null, startDate: today, endDate: today, note: "", stillGoing: view === "start" };
}

export { SOFT_ERROR, PLUM };
