import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import { SheetHeader, SOFT_ERROR } from "./FormSheet";
import { describeChange, describeChangeDate } from "../theme/medications";
import api from "../lib/api";

/**
 * What this medication's dosage and schedule used to be, newest first.
 *
 * Every medication has at least an "Added" entry — for one that predates the
 * feature the server derives it from `createdAt` and carries no field values,
 * because it genuinely does not know what they were. So there is no empty
 * state to write.
 *
 * The web twin is client/src/components/MedHistoryModal.jsx.
 */
export default function MedHistorySheet({ visible, med, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setEntries(null);
    try {
      const res = await api.get(`/api/medications/${med.id}/history`);
      setEntries(res.data.entries || []);
    } catch {
      setError("Couldn't load history. Try again.");
    }
  };

  useEffect(() => {
    if (visible && med) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, med?.id]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      scrollable={false}
      cardStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <SheetHeader title={med ? `${med.name} history` : "History"} />

      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={{ gap: 8, alignItems: "flex-start" }}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity
              onPress={load}
              style={styles.retryBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : entries === null ? (
          <View style={{ paddingVertical: 16, alignItems: "center" }}>
            <ActivityIndicator color="white" />
          </View>
        ) : (
          entries.map((entry, i) => {
            const lines = describeChange(entry);
            return (
              <View
                key={entry.id ?? `derived-${i}`}
                style={styles.entry}
                accessible
                accessibilityLabel={`${describeChangeDate(entry.changedAt)}: ${lines.join(", ")}`}
              >
                <Text style={styles.date}>{describeChangeDate(entry.changedAt)}</Text>
                {lines.map((line, j) => (
                  <Text key={j} style={styles.line}>{line}</Text>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.6}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  entry: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  date: { fontFamily: "Lato_400Regular", fontSize: 11, color: "rgba(255,255,255,0.5)" },
  line: { fontFamily: "Lato_400Regular", fontSize: 15, color: "white", marginTop: 2 },
  error: { fontFamily: "Lato_400Regular", fontSize: 14, color: SOFT_ERROR },
  retryBtn: { minHeight: 44, justifyContent: "center" },
  retryText: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)" },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  closeBtn: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 44, justifyContent: "center" },
  closeText: { fontFamily: "Lato_400Regular", fontSize: 15, color: "rgba(255,255,255,0.7)" },
});
