import {
  Modal, KeyboardAvoidingView, TouchableOpacity, View, ScrollView, Platform, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Slide-up bottom sheet with the app's standard frosted card, scrim,
 * tap-to-dismiss, and keyboard avoidance. By default the card scrolls, so a
 * filled-out form (or the keyboard on smaller iPhones) can never clip the
 * bottom action buttons. Sheets that manage their own inner ScrollView should
 * pass `scrollable={false}` to avoid nested scrolling.
 */
export default function BottomSheet({
  visible, onClose, children, maxHeight = "88%", cardStyle, scrollable = true,
}) {
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
        <View style={[styles.card, { maxHeight }, cardStyle]}>
          {scrollable ? (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 24,
                paddingBottom: insets.bottom + 20,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, paddingBottom: insets.bottom + 20 }}>{children}</View>
          )}
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
    overflow: "hidden",
  },
});
