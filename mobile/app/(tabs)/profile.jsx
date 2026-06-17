import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ScreenBackground from "../../components/ScreenBackground";
import Avatar from "../../components/Avatar";
import { useAuth } from "../../context/AuthContext";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScreenBackground>
      <View style={styles.container}>
        {/* Avatar + account info */}
        <View style={styles.headerBlock}>
          <Avatar user={user} size={96} />
          <Text style={styles.username}>{user?.username || "—"}</Text>
          <Text style={styles.email}>{user?.email || ""}</Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={signOut}
          activeOpacity={0.75}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 32,
  },
  headerBlock: {
    alignItems: "center",
    gap: 12,
  },
  username: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: "white",
    textAlign: "center",
  },
  email: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  signOutBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  signOutText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.3,
  },
});
