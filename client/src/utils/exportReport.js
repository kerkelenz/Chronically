import axios from "axios";
import { generateReport } from "./generateReport";
import { track } from "../lib/analytics";

export const exportDoctorReport = async ({ token, username }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const base    = import.meta.env.VITE_API_URL;
  const today   = new Date().toLocaleDateString("en-CA");
  const start   = new Date();
  start.setDate(start.getDate() - 30);
  const startDate = start.toLocaleDateString("en-CA");

  const [checkInsRes, medsRes, logsRes, apptsRes, insights] = await Promise.all([
    axios.get(`${base}/api/checkins`, { headers }),
    axios.get(`${base}/api/medications`, { headers }),
    axios.get(`${base}/api/medications/logs?startDate=${startDate}&endDate=${today}`, { headers }),
    axios.get(`${base}/api/appointments`, { headers }),
    // Observed Patterns is a bonus section — an export must never fail because
    // insights didn't load
    axios.get(`${base}/api/insights`, { headers }).then((r) => r.data).catch(() => null),
  ]);

  generateReport(
    checkInsRes.data.checkIns,
    username,
    medsRes.data.medications,
    logsRes.data.logs,
    apptsRes.data.appointments,
    insights,
  );

  // covers both export buttons (dashboard and appointments) in one place
  track("report_exported");
};
