import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../components/ScreenBackground";
import ChronicleMark from "../components/ChronicleMark";
import api from "../lib/api";

// "12 September 2026" — matches the web copy exactly
const formatDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * The permanent record of everything Chronicle has said. Dismissing the
 * dashboard card clears it from the dashboard; this is where it still lives.
 *
 * Read-only by design — no unread state, no way to re-show a card. The moment
 * this grows state to manage it stops being a gentle channel.
 */
export default function ChronicleScreen() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstLoadRef = useRef(true);

  const load = async () => {
    try {
      const res = await api.get("/api/announcements/history");
      return res.data.announcements || [];
    } catch {
      // silent-fail: an empty history reads better than an error dump
      return [];
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isFirstLoadRef.current) setLoading(true);
      (async () => {
        const list = await load();
        if (active) {
          setAnnouncements(list);
          setLoading(false);
          isFirstLoadRef.current = false;
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setAnnouncements(await load());
    setRefreshing(false);
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255,255,255,0.8)"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>From Chronicle</Text>
          {/* balances the back chevron so the title stays optically centred */}
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <ActivityIndicator color="rgba(255,255,255,0.8)" style={{ marginTop: 40 }} />
        ) : announcements.length === 0 ? (
          <View style={styles.empty}>
            <ChronicleMark size={44} />
            <Text style={styles.emptyText}>Nothing from Chronicle yet.</Text>
          </View>
        ) : (
          announcements.map((a) => (
            <View key={a.id} style={styles.card}>
              <ChronicleMark size={32} />
              <View style={styles.content}>
                <Text style={styles.title}>{a.title}</Text>
                <Text style={styles.date}>{formatDate(a.publishedAt)}</Text>
                <Text style={styles.body}>{a.body}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pageTitle: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 28, color: "white" },
  headerSpacer: { width: 24 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    padding: 16,
    marginBottom: 12,
  },
  content: { flex: 1, minWidth: 0 },
  title: { fontFamily: "Lato_700Bold", fontSize: 15, color: "white" },
  date: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  body: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
    lineHeight: 20,
  },
  empty: { alignItems: "center", gap: 12, paddingTop: 48 },
  emptyText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
});
