import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
} from "react-native";
import BottomSheet from "./BottomSheet";
import { SheetHeader, formStyles } from "./FormSheet";
import api from "../lib/api";

/**
 * Picks a weather location by name — never from device GPS, so there is no OS
 * permission prompt and nothing to declare on the privacy label.
 *
 * Two steps on purpose: searching returns candidates, choosing one saves it.
 * "Springfield" is five different places and the user has to say which.
 */
export default function WeatherLocationSheet({ visible, current, onClose, onSaved }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setQuery(""); setResults(null); setSearching(false); setSaving(false); setError("");
  };

  const close = () => { reset(); onClose(); };

  const label = (p) => [p.name, p.admin1, p.country].filter(Boolean).join(", ");

  const search = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError("");
    try {
      const res = await api.post("/api/users/weather-location", { query: query.trim() });
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
      const res = await api.post("/api/users/weather-location", {
        latitude: place.latitude, longitude: place.longitude, name: label(place),
      });
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
      await api.delete("/api/users/weather-location");
      onSaved(null);
      close();
    } catch {
      setError("Couldn't remove that location. Please try again.");
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <SheetHeader
        title="Weather"
        subtitle="Used to look for patterns between the weather and how you feel. Your city only — never your exact location."
      />

      {current ? (
        <View style={styles.currentWrap}>
          <Text style={formStyles.label}>Current</Text>
          <Text style={styles.current}>{current}</Text>
        </View>
      ) : null}

      <Text style={formStyles.label}>City or postal code</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={[formStyles.input, styles.searchInput]}
          value={query}
          onChangeText={(v) => { setQuery(v); setError(""); }}
          placeholder="Torrance"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={search}
          accessibilityLabel="City or postal code"
        />
        <TouchableOpacity
          style={[styles.searchBtn, (!query.trim() || searching) && styles.searchBtnDisabled]}
          onPress={search}
          disabled={!query.trim() || searching}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          {searching
            ? <ActivityIndicator size="small" color="#7C6BAE" />
            : <Text style={styles.searchBtnText}>Search</Text>}
        </TouchableOpacity>
      </View>

      {error ? <Text style={formStyles.error}>{error}</Text> : null}

      {results !== null && results.length === 0 && !searching ? (
        <Text style={styles.noResults}>
          No places matched that. Try a nearby larger town.
        </Text>
      ) : null}

      {results !== null && results.length > 0 ? (
        <View style={styles.resultList}>
          {results.map((p, i) => (
            <TouchableOpacity
              key={`${p.latitude},${p.longitude},${i}`}
              style={styles.resultRow}
              onPress={() => choose(p)}
              disabled={saving}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Use ${label(p)}`}
            >
              <Text style={styles.resultText}>{label(p)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {current ? (
          <TouchableOpacity
            onPress={remove}
            disabled={saving}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Remove weather location"
          >
            <Text style={styles.removeText}>Remove location</Text>
          </TouchableOpacity>
        ) : <View />}
        <TouchableOpacity onPress={close} disabled={saving} activeOpacity={0.7}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  currentWrap: { marginBottom: 4 },
  current: { fontFamily: "Lato_400Regular", fontSize: 15, color: "white" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, marginTop: 0 },
  searchBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999,
    backgroundColor: "white", minWidth: 92, alignItems: "center", justifyContent: "center",
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: { fontFamily: "Lato_700Bold", fontSize: 14, color: "#7C6BAE" },
  noResults: {
    fontFamily: "Lato_400Regular", fontSize: 13,
    color: "rgba(255,255,255,0.6)", marginTop: 14,
  },
  resultList: { marginTop: 14 },
  resultRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  resultText: { fontFamily: "Lato_400Regular", fontSize: 15, color: "rgba(255,255,255,0.9)" },
  actions: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 22,
  },
  // plum, never red — removing a location is reversible and loses no history
  removeText: { fontFamily: "Lato_400Regular", fontSize: 14, color: "#E6D7EC" },
  doneText: { fontFamily: "Lato_700Bold", fontSize: 15, color: "white" },
});
