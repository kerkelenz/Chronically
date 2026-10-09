/**
 * The one definition of what a check-in note may be.
 *
 * A note is one short line of the user's own words — the context a 1-to-5 scale
 * cannot hold. It is never analysed: not by the insight engine, not by
 * analytics, not in a notification. It exists to be read back to the person who
 * wrote it, and to be printed in the doctor report.
 *
 * Null means "not given". That is distinct from an empty string, and the
 * difference matters at the API edge: an omitted note leaves an existing one
 * alone, while an explicit null or "" clears it.
 */

// Twitter-length, and the same unit on both sides of the wire: JS `.length`
// counts UTF-16 code units, which is what the web textarea's maxLength and
// React Native's maxLength also count. A limit the client enforces and the
// server disagrees with is a 400 nobody can explain.
const NOTE_MAX = 280;

/**
 * @param {*} raw whatever arrived in the request body
 * @returns {{ value?: string|null|undefined, error?: string }}
 *   `{ value: undefined }` means "not sent" — the caller should leave the
 *   stored note untouched. `{ value: null }` means "clear it".
 */
function parseNote(raw) {
  // not sent at all — an update must not treat this as "clear it"
  if (raw === undefined) return { value: undefined };
  if (raw === null) return { value: null };

  // a number or object here is a client bug, not something to coerce: String(42)
  // would silently store "42" as the user's own words
  if (typeof raw !== "string") return { error: "Note must be text." };

  // One line by design. Collapsing rather than rejecting newlines means a
  // pasted paragraph becomes a sentence instead of an error.
  const collapsed = raw.replace(/\s*[\r\n]+\s*/g, " ").trim();
  if (collapsed === "") return { value: null };

  // measured after collapsing, so trailing newlines cannot push a note over
  if (collapsed.length > NOTE_MAX) {
    return { error: `Notes can be up to ${NOTE_MAX} characters.` };
  }
  return { value: collapsed };
}

module.exports = { NOTE_MAX, parseNote };
