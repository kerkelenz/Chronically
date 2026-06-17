import { View, Text, Image, StyleSheet } from "react-native";

export default function Avatar({ user, size = 40 }) {
  const radius = size / 2;

  if (user?.avatar) {
    return (
      <Image
        source={{ uri: user.avatar }}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() || "?";
  const fontSize = Math.round(size * 0.33);

  return (
    <View
      style={[
        styles.initialsCircle,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text style={[styles.initialsText, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initialsCircle: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    fontFamily: "Lato_700Bold",
    color: "white",
  },
});
