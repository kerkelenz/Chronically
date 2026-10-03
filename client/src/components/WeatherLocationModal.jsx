import { useState } from "react";
import axios from "axios";
import FormModal, { labelClass } from "./FormModal";

/**
 * Picks a weather location by name — never from browser geolocation, so there
 * is no permission prompt and no precise coordinates.
 *
 * Two steps on purpose: searching returns candidates, choosing one saves it.
 * "Springfield" is five different places and the user has to say which.
 */
export default function WeatherLocationModal({ open, current, token, onClose, onSaved }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const base = import.meta.env.VITE_API_URL;
  const headers = { Authorization: `Bearer ${token}` };
  const label = (p) => [p.name, p.admin1, p.country].filter(Boolean).join(", ");

  const close = () => {
    setQuery(""); setResults(null); setSearching(false); setSaving(false); setError("");
    onClose();
  };

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim() || searching) return;
    setSearching(true);
    setError("");
    try {
      const res = await axios.post(
        `${base}/api/users/weather-location`, { query: query.trim() }, { headers },
      );
      setResults(res.data.results || []);
    } catch {
      setError("Couldn't search right now. Please try again.");
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const choose = async (place) => {
    setSaving(true);
    setError("");
    try {
      const res = await axios.post(
        `${base}/api/users/weather-location`,
        { latitude: place.latitude, longitude: place.longitude, name: label(place) },
        { headers },
      );
      onSaved(res.data.weatherLocation);
      close();
    } catch {
      setError("Couldn't save that location. Please try again.");
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError("");
    try {
      await axios.delete(`${base}/api/users/weather-location`, { headers });
      onSaved(null);
      close();
    } catch {
      setError("Couldn't remove that location. Please try again.");
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={close}
      title="Weather"
      subtitle="Used to look for patterns between the weather and how you feel. Your city only — never your exact location."
      footer={
        <div className="flex items-center justify-between gap-2">
          {current ? (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="px-4 py-2.5 rounded-full text-sm transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ color: "#E6D7EC" }}
            >
              Remove location
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "white", color: "#7C6BAE", minWidth: 92 }}
          >
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {current ? (
          <div>
            <p className={labelClass}>Current</p>
            <p className="text-sm text-white">{current}</p>
          </div>
        ) : null}

        <form onSubmit={search}>
          <label className={labelClass} htmlFor="weather-query">City or postal code</label>
          <div className="flex items-center gap-2">
            <input
              id="weather-query"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setError(""); }}
              placeholder="Torrance"
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "white" }}
            />
            <button
              type="submit"
              disabled={!query.trim() || searching}
              className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "white", color: "#7C6BAE", minWidth: 86 }}
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
        </form>

        {error ? <p className="text-sm text-white/85">{error}</p> : null}

        {results !== null && results.length === 0 && !searching ? (
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            No places matched that. Try a nearby larger town.
          </p>
        ) : null}

        {results !== null && results.length > 0 ? (
          <div className="flex flex-col">
            {results.map((p, i) => (
              <button
                key={`${p.latitude},${p.longitude},${i}`}
                type="button"
                onClick={() => choose(p)}
                disabled={saving}
                className="w-full py-3 text-left text-sm transition-colors hover:bg-white/10 disabled:opacity-50"
                style={{ color: "rgba(255,255,255,0.9)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}
              >
                {label(p)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </FormModal>
  );
}
