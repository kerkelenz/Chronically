import { View, Text, StyleSheet } from "react-native";

export default function AdherenceBars({ data }) {
  return (
    <View style={styles.container}>
      {data.map((item, idx) => (
        <View key={item.name + idx} style={styles.row}>
          <Text style={styles.medName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.trackWrap}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: item.adherence > 0 ? `${item.adherence}%` : 0 },
                ]}
              />
            </View>
          </View>
          <View style={styles.pctWrap}>
            <Text style={styles.pctText}>{item.adherence}%</Text>
            <Text style={styles.fracText}>
              {item.taken}/{item.scheduled}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  medName: {
    width: 90,
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "white",
  },
  trackWrap: {
    flex: 1,
    justifyContent: "center",
  },
  track: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    backgroundColor: "#7C6BAE",
    borderRadius: 4,
  },
  pctWrap: {
    width: 48,
    alignItems: "flex-end",
  },
  pctText: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "white",
  },
  fracText: {
    fontFamily: "Lato_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
});
