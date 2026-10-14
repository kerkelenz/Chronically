import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import TipAnchor from "./TipAnchor";

function LevelBtn({ level, labels, selected, onSelect, style }) {
  const active = selected === level;
  return (
    <TouchableOpacity
      style={[styles.btn, style, active && styles.btnActive]}
      onPress={() => onSelect(level)}
      activeOpacity={0.8}
    >
      <Text style={[styles.label, active && styles.labelActive]}>
        {labels[level]}
      </Text>
    </TouchableOpacity>
  );
}

export default function LevelButtons({ labels, selected, onSelect, tipAnchor }) {
  const props = { labels, selected, onSelect };
  const grid = (
    <View style={styles.grid}>
      <View style={styles.row}>
        <LevelBtn level={1} {...props} style={styles.half} />
        <LevelBtn level={2} {...props} style={styles.half} />
      </View>
      <View style={styles.row}>
        <LevelBtn level={3} {...props} style={styles.half} />
        <LevelBtn level={4} {...props} style={styles.half} />
      </View>
      <LevelBtn level={5} {...props} />
    </View>
  );
  // a check-in's first question is what its first-visit tip points at
  return tipAnchor ? <TipAnchor id={tipAnchor} style={styles.anchor}>{grid}</TipAnchor> : grid;
}

const styles = StyleSheet.create({
  grid: {
    gap: 12,
    width: "100%",
  },
  anchor: { width: "100%" },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  btn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  btnActive: {
    backgroundColor: "white",
  },
  label: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
  },
  labelActive: {
    color: "#7C6BAE",
  },
});
