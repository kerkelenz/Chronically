/**
 * Saved doctors are a form-filler, not a record anything depends on. An
 * appointment keeps its own copy of the doctor's name, specialty and location,
 * so editing or removing a saved doctor never rewrites history or a report.
 *
 * That choice is what makes this file necessary: with no foreign key, the only
 * way to connect a saved doctor to the appointments they appear in is by name,
 * and names are typed by hand. `normalizeName` is the single definition of
 * "the same doctor" — the model's beforeValidate hook and every lookup here
 * share it, so the stored key can't drift from the one a query computes.
 */

// Shown entries derived from appointment history. Saved doctors are never
// capped: the user chose each one, so dropping any would look like data loss.
const HISTORY_LIMIT = 20;

/**
 * The comparison form of a doctor's name: trimmed, internal runs of whitespace
 * collapsed to one space, lower-cased. "Dr.  RIVERA " and "dr. rivera" are one
 * doctor. Punctuation is deliberately kept — "Dr. Lee" and "Dr Lee" stay
 * distinct, because guessing which punctuation is meaningful in a name is how
 * you merge two different people.
 */
function normalizeName(name) {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// An absent specialty/location is stored either as null or as "", depending on
// whether the field was cleared or never filled. Both mean "nothing to show".
const firstNonEmpty = (...values) => {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
};

const timeOf = (date) => {
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Builds the picker's list from the user's saved doctors and their appointment
 * history, so someone who has never saved anyone still gets suggestions on
 * their first use.
 *
 * @param {Array} saved        Doctor rows: { id, name, nameKey?, specialty, location }
 * @param {Array} appointments { doctorName, specialty, location, date }
 * @returns {Array} { id|null, name, specialty, location, saved, lastSeen }
 */
function mergeDoctorSuggestions(saved = [], appointments = []) {
  const savedRows = Array.isArray(saved) ? saved : [];
  const apptRows = Array.isArray(appointments) ? appointments : [];

  // One pass over the appointments, grouped by normalized name. `specialty` and
  // `location` track the most recent NON-EMPTY value rather than the most
  // recent appointment's value: a visit logged without a location should not
  // erase the location the user typed last month.
  const history = new Map();
  for (const appt of apptRows) {
    const key = normalizeName(appt?.doctorName);
    if (!key) continue;
    const at = timeOf(appt?.date);

    let entry = history.get(key);
    if (!entry) {
      entry = { key, name: appt.doctorName, at, specialtyAt: null, specialty: null, locationAt: null, location: null };
      history.set(key, entry);
    }

    // the latest appointment wins the display spelling and the lastSeen date;
    // a row with an unparseable date can still contribute field values
    if (at !== null && (entry.at === null || at > entry.at)) {
      entry.at = at;
      entry.name = appt.doctorName;
    }

    const specialty = firstNonEmpty(appt?.specialty);
    if (specialty && (entry.specialtyAt === null || (at !== null && at >= entry.specialtyAt))) {
      entry.specialty = specialty;
      entry.specialtyAt = at ?? entry.specialtyAt ?? 0;
    }
    const location = firstNonEmpty(appt?.location);
    if (location && (entry.locationAt === null || (at !== null && at >= entry.locationAt))) {
      entry.location = location;
      entry.locationAt = at ?? entry.locationAt ?? 0;
    }
  }

  const savedKeys = new Set();
  const savedEntries = savedRows.map((row) => {
    // trust the row's own nameKey when present, but fall back to computing it
    // so a hand-built row (or a test fixture) behaves the same way
    const key = row?.nameKey || normalizeName(row?.name);
    savedKeys.add(key);
    const seen = history.get(key);
    return {
      id: row?.id ?? null,
      name: row?.name ?? "",
      specialty: firstNonEmpty(row?.specialty),
      location: firstNonEmpty(row?.location),
      saved: true,
      lastSeen: seen && seen.at !== null ? new Date(seen.at).toISOString() : null,
      _key: key,
      _at: seen && seen.at !== null ? seen.at : null,
    };
  });

  // A saved doctor is never also a history suggestion — one row per person.
  const historyEntries = [...history.values()]
    .filter((e) => !savedKeys.has(e.key))
    .map((e) => ({
      id: null,
      name: e.name,
      specialty: e.specialty,
      location: e.location,
      saved: false,
      lastSeen: e.at !== null ? new Date(e.at).toISOString() : null,
      _key: e.key,
      _at: e.at,
    }));

  // Cap history before the final sort, so the 20 kept are the 20 most recent
  // rather than whichever 20 happen to sort first.
  historyEntries.sort(byRecencyThenName);
  const cappedHistory = historyEntries.slice(0, HISTORY_LIMIT);

  const all = [...savedEntries, ...cappedHistory];
  all.sort(byRecencyThenName);

  return all.map(({ _key, _at, ...entry }) => entry);
}

// Most recently seen first; a doctor with no appointments yet sorts last rather
// than first. Ties break on the normalized key, which is unique across the
// result, so the order is total and two runs can never disagree. Deliberately
// not localeCompare: that varies with the server's locale.
function byRecencyThenName(a, b) {
  if (a._at !== b._at) {
    if (a._at === null) return 1;
    if (b._at === null) return -1;
    return b._at - a._at;
  }
  if (a._key < b._key) return -1;
  if (a._key > b._key) return 1;
  return 0;
}

module.exports = { normalizeName, mergeDoctorSuggestions, HISTORY_LIMIT };
