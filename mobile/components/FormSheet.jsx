import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

/**
 * Shared anatomy for the app's add/edit sheets. `BottomSheet` (or a centered
 * dialog) stays the shell — these pieces standardize the header, field
 * labels/inputs, and footer so every sheet reads identically.
 *
 * Contract:
 *  - Header: title left, Lato bold 18 white, no emoji; optional subtitle white 65%.
 *  - Fields: uppercase micro-label above the app's frosted input; 14px rhythm.
 *  - Footer: right-aligned pair — quiet text Cancel then white-pill Save
 *    (#7C6BAE bold text, the app's primary treatment). Save spins while saving
 *    and dims to 40% when invalid. Destructive actions never live here.
 *  - Error: one soft, non-red line above the footer.
 */

const PRIMARY = "#7C6BAE";

export function SheetHeader({ title, subtitle, right, style }) {
  return (
    <View style={[formStyles.header, style]}>
      <View style={{ flex: 1 }}>
        <Text style={formStyles.title}>{title}</Text>
        {subtitle ? <Text style={formStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? null}
    </View>
  );
}

export function SheetFooter({
  onCancel,
  onSave,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  saving = false,
  canSave = true,
  error,
  style,
}) {
  return (
    <View style={[formStyles.footerWrap, style]}>
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      <View style={formStyles.footerRow}>
        {onCancel ? (
          <TouchableOpacity
            style={formStyles.cancelBtn}
            onPress={onCancel}
            disabled={saving}
            activeOpacity={0.6}
          >
            <Text style={formStyles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[formStyles.saveBtn, !canSave && formStyles.saveBtnDisabled]}
          onPress={onSave}
          disabled={!canSave || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={PRIMARY} size="small" />
          ) : (
            <Text style={formStyles.saveText}>{saveLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: "Lato_700Bold",
    fontSize: 18,
    color: "white",
  },
  subtitle: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 3,
  },

  // Fields
  label: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    // marginTop carries the between-group rhythm: every field group starts with
    // a label, so this loosens group separation kit-wide (meds, appointments)
    // without per-sheet overrides. (fieldGroup below isn't consumed by the
    // sheets; the labels are.)
    marginTop: 18,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: 12,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  // Footer
  footerWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingBottom: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cancelText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
  },
  saveBtn: {
    backgroundColor: "white",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 26,
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: PRIMARY,
  },
  error: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "right",
    marginBottom: 8,
  },
});
