import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { MILESTONE_COPY } from "../lib/milestones";

const CONFETTI_COLORS = ["#7C6BAE", "#9B8EC4", "#C4A8C0", "#C4A882", "#7FAF8A", "#FFFFFF"];

export default function MilestoneCelebration({ milestone, onDismiss }) {
  const { width } = useWindowDimensions();
  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <ConfettiCannon
          count={150}
          origin={{ x: width / 2, y: -20 }}
          autoStart
          fadeOut
          explosionSpeed={350}
          fallSpeed={2800}
          colors={CONFETTI_COLORS}
        />
        <View style={styles.card}>
          <Text style={styles.number}>{milestone}</Text>
          <Text style={styles.sub}>days checked in</Text>
          <Text style={styles.copy}>{MILESTONE_COPY[milestone]}</Text>
          <TouchableOpacity style={styles.btn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.btnText}>Keep it up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    paddingVertical: 32,
    paddingHorizontal: 28,
    borderRadius: 28,
    alignItems: "center",
    backgroundColor: "rgba(120,105,160,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  number: { fontFamily: "Lato_700Bold", fontSize: 52, color: "white", lineHeight: 58 },
  sub: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  copy: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 18,
    color: "white",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 24,
  },
  btn: { marginTop: 22, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 999, backgroundColor: "white" },
  btnText: { fontFamily: "Lato_700Bold", fontSize: 14, color: "#7C6BAE" },
});
