import axios from "axios";
import { generateReport } from "./generateReport";
import { track } from "../lib/analytics";
import { localToday } from "./flareHelpers";
import { resolveReportOptions } from "./reportOptions";

/**
 * Fetches what the report needs for the chosen range and downloads the PDF.
 *
 * `options = { from, to, sections, heading }` — see generateReport. `{}` is the
 * default report. Flares and medication history are fetched only when their
 * section is on, and passed to the generator as `options.flares` /
 * `options.medHistory`; either stays `undefined` (section left out) if its
 * request fails, so a report never claims "none" for something it couldn't load.
 */
export const exportDoctorReport = async ({ token, username, options = {} }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const base    = import.meta.env.VITE_API_URL;
  const range   = resolveReportOptions(options, localToday());
  const span    = `startDate=${range.from}&endDate=${range.to}`;

  const [checkInsRes, medsRes, logsRes, apptsRes, insights, flares] = await Promise.all([
    axios.get(`${base}/api/checkins?${span}`, { headers }),
    axios.get(`${base}/api/medications`, { headers }),
    axios.get(`${base}/api/medications/logs?${span}`, { headers }),
    axios.get(`${base}/api/appointments`, { headers }),
    // Observed Patterns is a bonus section — an export must never fail because
    // insights didn't load
    axios.get(`${base}/api/insights`, { headers }).then((r) => r.data).catch(() => null),
    range.sections.has("flares")
      ? axios.get(`${base}/api/flares?${span}`, { headers }).then((r) => r.data.flares || []).catch(() => undefined)
      : undefined,
  ]);

  const medications = medsRes.data.medications;
  // There is no bulk history endpoint, so one request per medication. A partial
  // history would misstate what changed, so any failure drops the whole section.
  let medHistory;
  if (range.sections.has("medChanges")) {
    try {
      const entries = await Promise.all(medications.map((m) =>
        axios.get(`${base}/api/medications/${m.id}/history`, { headers }).then((r) => [m.id, r.data.entries || []])));
      medHistory = Object.fromEntries(entries);
    } catch {
      medHistory = undefined;
    }
  }

  generateReport(
    checkInsRes.data.checkIns,
    username,
    medications,
    logsRes.data.logs,
    apptsRes.data.appointments,
    insights,
    // weather rides along with the check-ins request
    checkInsRes.data.weather || [],
    { ...options, flares, medHistory },
  );

  // covers both export buttons (dashboard and appointments) in one place
  track("report_exported");
};
