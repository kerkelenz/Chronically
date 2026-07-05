import { Modal, KeyboardAvoidingView, TouchableOpacity, View, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Slide-up bottom sheet with the app's standard frosted card, scrim,
 * tap-to-dismiss, keyboard avoidance, and — importantly — the bottom
 * safe-area inset baked in so content never sits under the nav bar.
 * Wrap any sheet content in this instead of hand-rolling a <Modal>.
 */
export default function BottomSheet({ visible, onClose, children, maxHeight = "88%" }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="slide"
      transparent
      statusBarTranslucent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.scrim}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, { maxHeight, paddingBottom: insets.bottom + 20 }]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  card: {
    backgroundColor: "rgba(52,38,86,0.98)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
});
