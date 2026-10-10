// Runs once, before any test worker starts, so every worker inherits it. A
// laptop and a UTC CI runner then see the same dates; a negative offset is the
// harder case, where date-only strings slip a day.
module.exports = async () => {
  process.env.TZ = "America/Los_Angeles";
};
