import {
  MAX_SUGGESTIONS,
  matchDoctors,
  matchesExactly,
  isAlreadySaved,
  describeDoctor,
  suggestionLabel,
} from "../utils/doctorHelpers";

/**
 * Sits under the Doctor name field in the appointment form: a short list of
 * doctors to fill the form from, and (when adding) the offer to remember a new
 * one. The web twin of mobile/components/DoctorPicker.jsx — same rules, same
 * copy, same order.
 *
 * Suggestions come from the user's saved list AND from names found in their own
 * past appointments, which is why this is useful on the very first use. The two
 * kinds look identical on purpose: the difference is bookkeeping, not something
 * the user should have to reason about mid-form.
 *
 * Everything here is optional. With no suggestions the block renders nothing,
 * so a new account sees exactly the form it saw before.
 */
export default function DoctorPicker({
  doctors,
  name,
  onPick,
  // the save offer belongs to the add form only; editing an appointment is not
  // the moment to ask about managing a list
  showSaveOption = false,
  saveChecked = true,
  onSaveCheckedChange,
}) {
  const list = Array.isArray(doctors) ? doctors : [];
  const matches = matchDoctors(list, name);

  // The list steps aside once it has nothing left to offer: no matches, or the
  // field already holds one of the names. No "no results" line — an empty
  // search is not an error worth narrating.
  const showList = matches.length > 0 && !matchesExactly(list, name);

  const trimmedName = (name || "").trim();
  const offerSave = showSaveOption && trimmedName !== "" && !isAlreadySaved(list, name);

  if (!showList && !offerSave) return null;

  return (
    <div className="flex flex-col gap-2 mt-2">
      {showList && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-white/50">
            Your doctors
          </p>
          {matches.map((doctor) => {
            const detail = describeDoctor(doctor);
            return (
              <button
                key={`${doctor.id ?? "history"}-${doctor.name}`}
                type="button"
                onClick={() => onPick?.(doctor)}
                aria-label={suggestionLabel(doctor)}
                className="w-full text-left px-3 py-2 rounded-xl transition-all duration-150 hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  minHeight: 44,
                }}
              >
                <span className="block text-sm text-white truncate">{doctor.name}</span>
                {detail ? (
                  <span className="block text-xs text-white/60 truncate">{detail}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {offerSave && (
        <label
          htmlFor="save-doctor"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer"
          style={{ minHeight: 44 }}
        >
          <input
            id="save-doctor"
            type="checkbox"
            checked={saveChecked}
            onChange={(e) => onSaveCheckedChange?.(e.target.checked)}
            className="w-4 h-4 flex-shrink-0 accent-white cursor-pointer"
          />
          <span className="text-sm text-white/80">
            Save {trimmedName} for next time
          </span>
        </label>
      )}
    </div>
  );
}

export { MAX_SUGGESTIONS };
