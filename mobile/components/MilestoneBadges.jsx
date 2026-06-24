import { View, Text, StyleSheet } from "react-native";

export default function MilestoneBadges({ milestones }) {
  if (!milestones || milestones.length === 0) return null;
  return (
    <View style={styles.row}>
      {[...milestones].sort((a, b) => a - b).map((m) => (
        <View key={m} style={styles.badge}>
          <Text style={styles.badgeText}>{m}d</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  badgeText: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
  },
});
