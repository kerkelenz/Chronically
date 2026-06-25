import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import ScreenBackground from "../../components/ScreenBackground";
import Avatar from "../../components/Avatar";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import MilestoneBadges from "../../components/MilestoneBadges";

export default function ProfileScreen() {
  const { user, signOut, updateUser } = useAuth();

  // ── Profile form ──────────────────────────────────────────────────────────
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Avatar ────────────────────────────────────────────────────────────────
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // ── Delete account ────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const hasChanges =
    username !== (user?.username || "") || email !== (user?.email || "");

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handlePickPhoto() {
    setAvatarError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAvatarError("Photo access is needed to choose a picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;

    setSavingAvatar(true);
    try {
      const manip = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 256, height: 256 } }],
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      const dataUri = `data:image/jpeg;base64,${manip.base64}`;
      const res = await api.put("/api/users/avatar", { image: dataUri });
      await updateUser({ ...user, avatar: res.data.avatar });
    } catch (err) {
      setAvatarError(
        err.response?.data?.error || "Failed to save photo. Please try again."
      );
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleRemovePhoto() {
    setAvatarError("");
    setSavingAvatar(true);
    try {
      await api.delete("/api/users/avatar");
      await updateUser({ ...user, avatar: null });
    } catch (err) {
      setAvatarError(
        err.response?.data?.error || "Failed to remove photo. Please try again."
      );
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleSaveProfile() {
    if (!hasChanges) return;
    setSaving(true);
    setSaveError("");
    setSuccess("");
    try {
      const res = await api.put("/api/users/profile", { username, email });
      await updateUser({ ...user, username, email: res.data.user.email });
      if (res.data.emailPending) {
        setEmail(user.email); // revert field — new email is pending verification
      }
      setSuccess(res.data.message);
    } catch (err) {
      setSaveError(
        err.response?.data?.error || "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api.delete("/api/users/account");
      await signOut(); // AuthGate routes to login
    } catch (err) {
      setDeleteError(
        err.response?.data?.error || "Something went wrong. Please try again."
      );
      setDeleteLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScreenBackground edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Avatar section ─────────────────────────────────────────────── */}
          <View style={styles.avatarSection}>
            {savingAvatar ? (
              <View style={styles.avatarSpinner}>
                <ActivityIndicator color="rgba(255,255,255,0.7)" />
              </View>
            ) : (
              <Avatar user={user} size={96} />
            )}

            <View style={styles.photoControls}>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={handlePickPhoto}
                disabled={savingAvatar}
                activeOpacity={0.8}
              >
                <Text style={styles.photoBtnText}>
                  {user?.avatar ? "Change photo" : "Add photo"}
                </Text>
              </TouchableOpacity>

              {user?.avatar ? (
                <TouchableOpacity
                  style={[styles.photoBtn, styles.photoBtnRemove]}
                  onPress={handleRemovePhoto}
                  disabled={savingAvatar}
                  activeOpacity={0.8}
                >
                  <Text style={styles.photoBtnRemoveText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {!!avatarError && (
              <Text style={styles.avatarError}>{avatarError}</Text>
            )}
          </View>

          {/* ── Achievements ──────────────────────────────────────────────── */}
          {(user?.celebratedMilestones || []).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Achievements</Text>
              <MilestoneBadges milestones={user.celebratedMilestones} />
            </View>
          )}

          {/* ── Username / Email form ─────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Account info</Text>

            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={(v) => {
                setUsername(v);
                setSuccess("");
              }}
              autoCapitalize="none"
              returnKeyType="next"
              placeholderTextColor="rgba(255,255,255,0.35)"
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setSuccess("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              placeholderTextColor="rgba(255,255,255,0.35)"
            />

            {!!saveError && <Text style={styles.errorText}>{saveError}</Text>}
            {!!success && <Text style={styles.successText}>{success}</Text>}

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!hasChanges || saving) && styles.saveBtnDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={!hasChanges || saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Account / danger section ──────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Account</Text>

            <TouchableOpacity
              style={styles.legalRow}
              onPress={() => Linking.openURL("https://mychronically.app/privacy")}
              activeOpacity={0.7}
            >
              <Text style={styles.legalText}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legalRow}
              onPress={() => Linking.openURL("https://mychronically.app/terms")}
              activeOpacity={0.7}
            >
              <Text style={styles.legalText}>Terms of Service</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={signOut}
              activeOpacity={0.75}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => {
                setDeleteError("");
                setShowDeleteModal(true);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.deleteBtnText}>Delete account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteScrim}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>Delete your account?</Text>
            <Text style={styles.deleteBody}>
              This will permanently delete your account and all your check-in
              data. This cannot be undone.
            </Text>

            {!!deleteError && (
              <Text style={styles.deleteError}>{deleteError}</Text>
            )}

            <View style={styles.deleteFooter}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmBtn,
                  deleteLoading && styles.btnDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteLoading}
                activeOpacity={0.85}
              >
                {deleteLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },

  // Avatar section
  avatarSection: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  avatarSpinner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoControls: {
    flexDirection: "row",
    gap: 10,
  },
  photoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  photoBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
  },
  photoBtnRemove: {
    backgroundColor: "rgba(220,50,80,0.18)",
    borderColor: "rgba(220,50,80,0.35)",
  },
  photoBtnRemoveText: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "rgba(255,150,150,0.9)",
  },
  avatarError: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,170,170,0.9)",
    textAlign: "center",
    paddingHorizontal: 16,
  },

  // Form card
  card: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    padding: 16,
    gap: 4,
  },
  sectionLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
  },
  errorText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,180,180,0.9)",
    marginTop: 6,
  },
  successText: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(160,220,160,0.9)",
    marginTop: 6,
    lineHeight: 19,
  },
  saveBtn: {
    backgroundColor: "#7C6BAE",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
    letterSpacing: 0.3,
  },

  legalRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  legalText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
  },

  // Account section
  signOutBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    marginBottom: 8,
  },
  signOutText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.3,
  },
  deleteBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(220,50,80,0.18)",
    borderWidth: 1,
    borderColor: "rgba(220,50,80,0.35)",
  },
  deleteBtnText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "rgba(255,150,150,0.9)",
    letterSpacing: 0.3,
  },

  // Delete modal
  deleteScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  deleteCard: {
    backgroundColor: "rgba(52,38,86,0.98)",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    gap: 12,
  },
  deleteTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 20,
    color: "white",
    textAlign: "center",
  },
  deleteBody: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 21,
  },
  deleteError: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,170,170,0.9)",
    textAlign: "center",
  },
  deleteFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  deleteCancelText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#B07088",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  deleteConfirmText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
  },
});
