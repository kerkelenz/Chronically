import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  MAX_SUGGESTIONS,
  matchDoctors,
  matchesExactly,
  isAlreadySaved,
  describeDoctor,
  suggestionLabel,
} from "../theme/doctorHelpers";

/**
 * Sits under the Doctor name field in the appointment sheet: a short list of
 * doctors to fill the form from, and (when adding) the offer to remember a new
 * one. The mobile twin of client/src/components/DoctorPicker.jsx — same rules,
 * same copy, same order, both driven by theme/doctorHelpers.
 *
 * Suggestions come from the user's saved list AND from names found in their own
 * past appointments, which is why this is useful on the very first use. The two
 * kinds look identical on purpose: the difference is bookkeeping, not something
 * the user should have to reason about mid-form.
 *
 * Everything here is optional. With no suggestions the block renders nothing,
 * so a new account sees exactly the sheet it saw before.
 */
export default function DoctorPicker({
  doctors,
  name,
  onPick,
  showSaveOption = false,
  saveChecked = true,
  onSaveCheckedChange,
}) {
  const list = Array.isArray(doctors) ? doctors : [];
  const matches = matchDoctors(list, name);

  // The list steps aside once it has nothing left to offer: no matches, or the
  // field already holds one of the names. No "no results" line — an empty
  // search is not an error worth narrating.
  const showList = matches.length > 0 && !matchesExactly(list, name);

  const trimmedName = (name || "").trim();
  const offerSave = showSaveOption && trimmedName !== "" && !isAlreadySaved(list, name);

  if (!showList && !offerSave) return null;

  return (
    <View style={styles.wrap}>
      {showList ? (
        <View style={styles.list}>
          <Text style={styles.sectionLabel}>Your doctors</Text>
          {matches.map((doctor) => {
            const detail = describeDoctor(doctor);
            return (
              <TouchableOpacity
                key={`${doctor.id ?? "history"}-${doctor.name}`}
                style={styles.row}
                onPress={() => onPick?.(doctor)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={suggestionLabel(doctor)}
              >
                <Text style={styles.rowName} numberOfLines={1}>{doctor.name}</Text>
                {detail ? (
                  <Text style={styles.rowDetail} numberOfLines={1}>{detail}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {offerSave ? (
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => onSaveCheckedChange?.(!saveChecked)}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!saveChecked }}
          accessibilityLabel={`Save ${trimmedName} for next time`}
        >
          <View style={[styles.box, saveChecked && styles.boxChecked]}>
            {saveChecked ? <Text style={styles.tick}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>Save {trimmedName} for next time</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  list: { gap: 6 },
  sectionLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  row: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    // a comfortable target even when the row has only a name on it
    minHeight: 44,
    justifyContent: "center",
  },
  rowName: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
  },
  rowDetail: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingVertical: 4,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    // RN defaults flexShrink to 0, but be explicit: a long name must not
    // squeeze the box out of square
    flexShrink: 0,
  },
  boxChecked: {
    backgroundColor: "white",
    borderColor: "white",
  },
  tick: {
    color: "#7C6BAE",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  checkLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    flexShrink: 1,
  },
});

export { MAX_SUGGESTIONS };
