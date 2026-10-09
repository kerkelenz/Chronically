import { useEffect, useState } from "react";
import axios from "axios";
import FormModal, { SOFT_ERROR } from "./FormModal";
import { describeChange, describeChangeDate } from "../utils/medicationHelpers";

const API = import.meta.env.VITE_API_URL;

/**
 * What this medication's dosage and schedule used to be, newest first.
 *
 * Every medication has at least an "Added" entry — for one that predates the
 * feature the server derives it from `createdAt` and carries no field values,
 * because it genuinely does not know what they were. So there is no empty
 * state to write.
 *
 * The mobile twin is mobile/components/MedHistorySheet.jsx.
 */
export default function MedHistoryModal({ open, med, token, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setEntries(null);
    try {
      const res = await axios.get(`${API}/api/medications/${med.id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntries(res.data.entries || []);
    } catch {
      setError("Couldn't load history. Try again.");
    }
  };

  useEffect(() => {
    if (open && med) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, med?.id]);

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={med ? `${med.name} history` : "History"}
      footer={
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-sm text-white/70 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        {error ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm" style={{ color: SOFT_ERROR }}>{error}</p>
            <button
              type="button"
              onClick={load}
              className="text-xs text-white/70 hover:text-white transition-colors"
              style={{ minHeight: 44 }}
            >
              Try again
            </button>
          </div>
        ) : entries === null ? (
          <div className="flex justify-center py-4">
            <span
              className="inline-block w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(255,255,255,0.25)", borderTopColor: "white" }}
              aria-label="Loading history"
            />
          </div>
        ) : (
          entries.map((entry, i) => {
            const lines = describeChange(entry);
            return (
              <div
                key={entry.id ?? `derived-${i}`}
                className="px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
                aria-label={`${describeChangeDate(entry.changedAt)}: ${lines.join(", ")}`}
              >
                <p className="text-[11px] text-white/50">{describeChangeDate(entry.changedAt)}</p>
                {lines.map((line, j) => (
                  <p key={j} className="text-sm text-white mt-0.5">{line}</p>
                ))}
              </div>
            );
          })
        )}
      </div>
    </FormModal>
  );
}
