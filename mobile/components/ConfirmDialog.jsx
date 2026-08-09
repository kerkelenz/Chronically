import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

// Deep plum destructive treatment — visibly not the #7C6BAE save pill, and no
// red per the app's tone rules.
const PLUM = "#5A3A60";

/**
 * Centered, frosted confirmation for destructive actions. Interrupts (never
 * sheets), fades in, and cancels on scrim tap / Android back. Its footer
 * mirrors the form dialogs: a quiet text Cancel then the destructive verb as a
 * white pill with plum text.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  busy = false,
  error,
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={busy}
              activeOpacity={0.6}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onConfirm}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={PLUM} size="small" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "rgba(52,38,86,0.98)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    padding: 22,
    gap: 8,
  },
  title: {
    fontFamily: "Lato_700Bold",
    fontSize: 18,
    color: "white",
  },
  message: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
  },
  error: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
  },
  confirmBtn: {
    backgroundColor: "white",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: PLUM,
  },
});
