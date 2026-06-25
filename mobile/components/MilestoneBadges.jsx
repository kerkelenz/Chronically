import { View, Text, StyleSheet } from "react-native";
import { MILESTONES, MILESTONE_META } from "../lib/milestones";
import Badge from "./Badge";

export default function MilestoneBadges({ milestones }) {
  const earnedSet = new Set(milestones || []);
  return (
    <View>
      <Text style={styles.count}>
        {earnedSet.size} of {MILESTONES.length} earned
      </Text>
      <View style={styles.grid}>
        {MILESTONES.map((m) => {
          const got = earnedSet.has(m);
          return (
            <View key={m} style={styles.cell}>
              <Badge days={m} earned={got} size={64} />
              <Text style={[styles.name, !got && styles.dimText]}>
                {MILESTONE_META[m].name}
              </Text>
              <Text style={[styles.days, !got && styles.dimDays]}>
                {m} days
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  count: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  name: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "white",
    textAlign: "center",
    marginTop: 6,
  },
  days: {
    fontFamily: "Lato_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 2,
  },
  dimText: {
    color: "rgba(255,255,255,0.5)",
  },
  dimDays: {
    color: "rgba(255,255,255,0.35)",
  },
});
