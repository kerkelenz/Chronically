import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "./BottomSheet";
import ConfirmDialog from "./ConfirmDialog";
import { SheetHeader, SheetFooter, formStyles } from "./FormSheet";
import { describeDoctor } from "../theme/doctorHelpers";
import api from "../lib/api";

const PRIMARY = "#7C6BAE";
const EMPTY = { name: "", specialty: "", location: "" };

/**
 * Manages the saved list: rename, correct a specialty, remove someone, or add a
 * doctor without booking anything. The mobile twin of client/src/components/
 * DoctorsModal.jsx.
 *
 * Only `saved: true` entries appear. The picker also suggests doctors found in
 * past appointments, but those are not rows the user can edit or delete —
 * they're derived from history, and the only way to change them is to change
 * the appointment.
 *
 * Removing a doctor here never touches an appointment, which is what the
 * confirmation says in as many words.
 */
export default function DoctorsSheet({ visible, onClose, doctors, onChanged }) {
  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  // alphabetical here rather than by recency: this is a list to find someone in,
  // not a shortcut ordered by likelihood
  const saved = (Array.isArray(doctors) ? doctors : [])
    .filter((d) => d.saved)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const backToList = () => {
    setMode("list");
    setEditingId(null);
    setForm(EMPTY);
    setError("");
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError("");
    setMode("form");
  };

  const openEdit = (doctor) => {
    setEditingId(doctor.id);
    setForm({
      name: doctor.name || "",
      specialty: doctor.specialty || "",
      location: doctor.location || "",
    });
    setError("");
    setMode("form");
  };

  const handleSave = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.put(`/api/doctors/${editingId}`, form);
      } else {
        await api.post("/api/doctors", form);
      }
      await onChanged?.();
      backToList();
    } catch (err) {
      // the server's own words for a name clash; anything else stays generic
      setError(err?.response?.data?.error || "Could not save that doctor.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removing || removeBusy) return;
    setRemoveBusy(true);
    try {
      await api.delete(`/api/doctors/${removing.id}`);
      await onChanged?.();
      setRemoving(null);
    } catch {
      setError("Could not remove that doctor.");
      setRemoving(null);
    } finally {
      setRemoveBusy(false);
    }
  };

  const closeAll = () => {
    backToList();
    onClose?.();
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={closeAll}
        scrollable={false}
        cardStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
      >
        <SheetHeader
          title={mode === "form" ? (editingId ? "Edit doctor" : "Add doctor") : "My doctors"}
        />

        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mode === "form" ? (
            <>
              <Text style={[formStyles.label, { marginTop: 0 }]}>Doctor name *</Text>
              <TextInput
                style={formStyles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Dr. Smith" accessibilityLabel="Doctor name, required"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="words"
              />
              <Text style={formStyles.label}>Specialty</Text>
              <TextInput
                style={formStyles.input}
                value={form.specialty}
                onChangeText={(v) => setForm((f) => ({ ...f, specialty: v }))}
                placeholder="Neurology" accessibilityLabel="Specialty"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <Text style={formStyles.label}>Location</Text>
              <TextInput
                style={formStyles.input}
                value={form.location}
                onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
                placeholder="Hospital or clinic name" accessibilityLabel="Location"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </>
          ) : saved.length === 0 ? (
            <Text style={styles.empty}>
              Doctors you save show up here, and when you add an appointment.
            </Text>
          ) : (
            <View style={styles.list}>
              {error ? <Text style={styles.listError}>{error}</Text> : null}
              {saved.map((doctor) => {
                const detail = describeDoctor(doctor);
                return (
                  <View key={doctor.id} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>{doctor.name}</Text>
                      {detail ? (
                        <Text style={styles.rowDetail} numberOfLines={1}>{detail}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => openEdit(doctor)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${doctor.name}`}
                    >
                      <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => { setError(""); setRemoving(doctor); }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${doctor.name}`}
                    >
                      <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {mode === "form" ? (
          <SheetFooter
            onCancel={backToList}
            onSave={handleSave}
            saving={saving}
            canSave={!!form.name.trim()}
            error={error}
          />
        ) : (
          <View style={styles.listFooter}>
            <TouchableOpacity style={styles.closeBtn} onPress={closeAll} activeOpacity={0.6}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openAdd}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add doctor"
            >
              <Text style={styles.addText}>Add doctor</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      <ConfirmDialog
        visible={!!removing}
        title={removing ? `Remove ${removing.name}?` : ""}
        message="This only removes them from your saved list. Appointments you've already added aren't changed."
        confirmLabel="Remove"
        cancelLabel="Keep"
        busy={removeBusy}
        onCancel={() => setRemoving(null)}
        onConfirm={handleRemove}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  empty: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 20,
    paddingVertical: 4,
  },
  list: { gap: 8 },
  listError: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 6,
    minHeight: 44,
  },
  // RN defaults flexShrink to 0, so without this a long name pushes the
  // buttons off the row instead of truncating
  rowText: { flex: 1, flexShrink: 1, minWidth: 0 },
  rowName: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
  },
  rowDetail: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  listFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  closeBtn: { paddingVertical: 12, paddingHorizontal: 14 },
  closeText: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
  },
  addBtn: {
    backgroundColor: "white",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  addText: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: PRIMARY,
  },
});
