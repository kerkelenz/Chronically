import { View, Text, StyleSheet } from "react-native";
import ScreenBackground from "../../components/ScreenBackground";

export default function DashboardScreen() {
  return (
    <ScreenBackground>
      <View style={styles.center}>
        <Text style={styles.heading}>Dashboard</Text>
        <Text style={styles.sub}>Your health overview will live here.</Text>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  heading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "white",
    textAlign: "center",
  },
  sub: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
});
