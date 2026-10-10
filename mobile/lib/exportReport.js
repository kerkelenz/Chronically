import * as Print from "expo-print";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import api from "./api";
import { computeReportData } from "./reportData";
import { buildReportHtml } from "./reportHtml";
import { localToday } from "../theme/flareHelpers";
import { resolveReportOptions } from "../theme/reportOptions";

// The report is printed from a standalone HTML string with no base URL, so the
// brand mark has to travel inside it as a data URI. Read once, then reuse.
let brandMarkUri = null;
const loadBrandMark = async () => {
  if (brandMarkUri) return brandMarkUri;
  try {
    const asset = Asset.fromModule(require("../assets/logo-mark.png"));
    await asset.downloadAsync();
    const base64 = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    brandMarkUri = `data:image/png;base64,${base64}`;
    return brandMarkUri;
  } catch {
    // the report reads fine without the mark — never fail an export over it
    return null;
  }
};

/**
 * Fetches what the report needs for the chosen range, prints it to a PDF and
 * returns `{ shareUri }` for the share sheet. `fileName` (no extension)
 * overrides the default "Chronically-Doctor-Report-{date}". Throws if the report can't be
 * built; the screen owns the spinner, the error line and the share sheet.
 *
 * `options = { from, to, sections, heading }` — see computeReportData. `{}` is
 * the default report. Flares and medication history are fetched only when
 * their section is on, and passed on as `options.flares` / `options.medHistory`;
 * either stays `undefined` (section left out) if its request fails, so a
 * report never claims "none" for something it couldn't load.
 */
export async function prepareDoctorReport({ username, options = {}, fileName }) {
  const range = resolveReportOptions(options, localToday());
  const span = `startDate=${range.from}&endDate=${range.to}`;

  const [checkInsRes, medsRes, logsRes, apptsRes, insights, logoUri, flares] = await Promise.all([
    api.get(`/api/checkins?${span}`),
    api.get("/api/medications"),
    api.get(`/api/medications/logs?${span}`),
    api.get("/api/appointments"),
    // Observed Patterns is a bonus section — an export must never fail
    // because insights didn't load
    api.get("/api/insights").then((r) => r.data).catch(() => null),
    loadBrandMark(),
    range.sections.has("flares")
      ? api.get(`/api/flares?${span}`).then((r) => r.data.flares || []).catch(() => undefined)
      : undefined,
  ]);

  const medications = medsRes.data.medications;
  // There is no bulk history endpoint, so one request per medication. A partial
  // history would misstate what changed, so any failure drops the whole section.
  let medHistory;
  if (range.sections.has("medChanges")) {
    try {
      const entries = await Promise.all(medications.map((m) =>
        api.get(`/api/medications/${m.id}/history`).then((r) => [m.id, r.data.entries || []])));
      medHistory = Object.fromEntries(entries);
    } catch {
      medHistory = undefined;
    }
  }

  const full = { ...options, flares, medHistory };
  const data = computeReportData(
    checkInsRes.data.checkIns,
    medications,
    logsRes.data.logs,
    apptsRes.data.appointments,
    // weather rides along with the check-ins request
    checkInsRes.data.weather || [],
    full,
  );
  const html = buildReportHtml(data, username || "Patient", insights, logoUri, full);
  const { uri } = await Print.printToFileAsync({ html });
  const stamp = new Date().toLocaleDateString("en-CA");
  const name = fileName || `Chronically-Doctor-Report-${stamp}`;

  // Hand the PDF to the system share sheet — the user can save it to Files,
  // email it, print it, or send it anywhere. No folder picker (Android blocks
  // Download and other protected folders), works the same on iOS and Android.
  const dest = `${FileSystem.cacheDirectory}${name}.pdf`;
  let shareUri = uri;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest }); // friendly filename
    shareUri = dest;
  } catch {
    // fall back to the original temp uri if the rename copy fails
  }
  return { shareUri };
}
