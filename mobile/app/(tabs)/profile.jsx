import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ScreenBackground from "../../components/ScreenBackground";
import { useAuth } from "../../context/AuthContext";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScreenBackground>
      <View style={styles.center}>
        <Text style={styles.heading}>{user?.username || "Profile"}</Text>
        <Text style={styles.sub}>Your account settings will live here.</Text>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={signOut}
          activeOpacity={0.75}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
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
  logoutButton: {
    marginTop: 32,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  logoutText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.3,
  },
});
