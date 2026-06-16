import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ScreenBackground({ children, style }) {
  return (
    <LinearGradient
      colors={["#7C6BAE", "#9B8EC4", "#C4A8C0"]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.7, y: 0 }}
      end={{ x: 0.3, y: 1 }}
      style={StyleSheet.absoluteFill}
    >
      <SafeAreaView style={[styles.safe, style]}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
});
