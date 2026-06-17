export const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const formatApptDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatApptTime = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const dotColor = (status) => {
  if (status === "completed") return "#7FAF8A";
  if (status === "cancelled") return "rgba(255,255,255,0.3)";
  return "white";
};

const pad = (n) => String(n).padStart(2, "0");

export const toDateTimeLocal = (val) => {
  if (!val) return "";
  const d = new Date(val);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const toDateOnly = (val) => {
  if (!val) return "";
  const d = new Date(val);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};