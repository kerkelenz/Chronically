import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import BottomSheet from "./BottomSheet";
import ConfirmDialog from "./ConfirmDialog";
import { SheetHeader, SheetFooter, formStyles, PLUM } from "./FormSheet";
import { formatFlareRange, localToday } from "../theme/flareHelpers";
import api from "../lib/api";

const PRIMARY = "#7C6BAE";
const NOTE_MAX = 280;
const NOTE_COUNTER_FROM = 240;

/**
 * Every flare form in one place, because they are the same three fields in
 * different combinations and the server's validation messages have to surface
 * identically whichever one you came from:
 *
 *  - "start": Home's Having a flare? → Started + Note
 *  - "ease":  the ongoing card's It's eased → Ended
 *  - "list":  Trends → Your flares → the history, and from it the full editor
 *             (Started, Ended, Still going, Note) and Add a past flare
 *
 * The web twin is client/src/components/FlaresModal.jsx.
 */
export default function FlaresSheet({
  visible, onClose, mode = "list", flare = null, flares = [], onChanged,
}) {
  const today = localToday();

  const [view, setView] = useState(mode);
  const [form, setForm] = useState(() => seed(mode, flare, today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [picker, setPicker] = useState(null); // "start" | "end" on iOS

  const openForm = (nextView, target) => {
    setForm(seed(nextView, target, today));
    setError("");
    setPicker(null);
    setView(nextView);
  };

  const closeAll = () => { setError(""); setPicker(null); onClose?.(); };
  const backToList = () => { setError(""); setPicker(null); setView("list"); };

  // Android opens a modal picker; iOS shows an inline spinner, matching how the
  // appointment sheet already does dates.
  const pickDate = (field) => {
    const current = form[field] ? new Date(`${form[field]}T12:00:00`) : new Date();
    const min = field === "endDate" && form.startDate ? new Date(`${form.startDate}T12:00:00`) : undefined;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        maximumDate: new Date(`${today}T12:00:00`),
        minimumDate: min,
        onChange: (e, d) => {
          if (e.type !== "set" || !d) return;
          setForm((f) => ({ ...f, [field]: toYmd(d) }));
        },
      });
    } else {
      setPicker(field);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const body = {};
      if (view === "ease") {
        body.endDate = form.endDate;
      } else {
        body.startDate = form.startDate;
        body.note = form.note;
        // "Still going" carries what an empty field cannot: "no end" rather
        // than "not filled in yet"
        if (view !== "start") body.endDate = form.stillGoing ? null : form.endDate;
      }

      if (view === "start" || view === "add") await api.post("/api/flares", body);
      else await api.put(`/api/flares/${form.id}`, body);

      await onChanged?.();
      if (view === "start" || view === "ease") closeAll();
      else backToList();
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing || removeBusy) return;
    setRemoveBusy(true);
    try {
      await api.delete(`/api/flares/${removing.id}`);
      await onChanged?.();
      setRemoving(null);
    } catch {
      setError("Couldn't remove that. Please try again.");
      setRemoving(null);
    } finally {
      setRemoveBusy(false);
    }
  };

  const titles = {
    list: "Your flares",
    start: "Start a flare",
    ease: "Glad it's easing",
    edit: "Edit flare",
    add: "Add a past flare",
  };

  const canSave = view === "ease"
    ? !!form.endDate
    : !!form.startDate && (view === "start" || form.stillGoing || !!form.endDate);

  const dateRow = (field, label) => (
    <View>
      <Text style={formStyles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => pickDate(field)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${form[field] || "not set"}`}
      >
        <Text style={styles.dateText}>{form[field] || "Choose a date"}</Text>
        <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
      {picker === field && Platform.OS === "ios" ? (
        <View style={styles.inlinePicker}>
          <DateTimePicker
            value={form[field] ? new Date(`${form[field]}T12:00:00`) : new Date()}
            mode="date"
            display="spinner"
            themeVariant="dark"
            maximumDate={new Date(`${today}T12:00:00`)}
            minimumDate={field === "endDate" && form.startDate
              ? new Date(`${form.startDate}T12:00:00`) : undefined}
            onChange={(e, d) => { if (d) setForm((f) => ({ ...f, [field]: toYmd(d) })); }}
          />
          <TouchableOpacity onPress={() => setPicker(null)} style={styles.pickerDone} activeOpacity={0.7}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={closeAll}
        scrollable={false}
        cardStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
      >
        <SheetHeader
          title={titles[view]}
          subtitle={view === "start" ? "Mark the day it began. You can end it whenever it eases." : undefined}
        />

        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {view === "list" ? (
            flares.length === 0 ? (
              <Text style={styles.empty}>
                When you mark a flare from Home, it shows up here.
              </Text>
            ) : (
              <View style={styles.list}>
                {error ? <Text style={styles.listError}>{error}</Text> : null}
                {flares.map((f) => (
                  <View key={f.id} style={styles.row}>
                    <Text style={styles.rowRange}>{formatFlareRange(f, today)}</Text>
                    {f.note ? (
                      <Text style={styles.rowNote} numberOfLines={2}>{f.note}</Text>
                    ) : null}
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        onPress={() => openForm("edit", f)}
                        style={styles.rowBtn}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit flare ${formatFlareRange(f, today)}`}
                      >
                        <Text style={styles.rowBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { setError(""); setRemoving(f); }}
                        style={styles.rowBtn}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove flare ${formatFlareRange(f, today)}`}
                      >
                        <Text style={styles.rowBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : view === "ease" ? (
            dateRow("endDate", "Ended")
          ) : (
            <>
              {dateRow("startDate", "Started")}

              {view !== "start" ? (
                <>
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => setForm((f) => ({ ...f, stillGoing: !f.stillGoing }))}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!form.stillGoing }}
                    accessibilityLabel="Still going"
                  >
                    <View style={[styles.box, form.stillGoing && styles.boxChecked]}>
                      {form.stillGoing ? <Text style={styles.tick}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkLabel}>Still going</Text>
                  </TouchableOpacity>
                  {!form.stillGoing ? dateRow("endDate", "Ended") : null}
                </>
              ) : null}

              <Text style={formStyles.label}>Note</Text>
              <TextInput
                style={styles.noteInput}
                value={form.note}
                onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
                multiline
                maxLength={NOTE_MAX}
                blurOnSubmit
                returnKeyType="done"
                placeholder="Anything you want to remember about it"
                placeholderTextColor="rgba(255,255,255,0.4)"
                accessibilityLabel="Note"
              />
              {form.note.length >= NOTE_COUNTER_FROM ? (
                <Text style={styles.counter} accessibilityLiveRegion="polite">
                  {form.note.length}/{NOTE_MAX}
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>

        {view === "list" ? (
          <View style={styles.listFooter}>
            <TouchableOpacity style={styles.closeBtn} onPress={closeAll} activeOpacity={0.6}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => openForm("add", null)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add a past flare"
            >
              <Text style={styles.addText}>Add a past flare</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SheetFooter
            onCancel={mode === "list" ? backToList : closeAll}
            onSave={save}
            saveLabel={view === "start" ? "Start" : "Save"}
            saving={saving}
            canSave={canSave}
            error={error}
          />
        )}
      </BottomSheet>

      <ConfirmDialog
        visible={!!removing}
        title="Remove this flare?"
        message="This only removes the dates you marked. Your check-ins aren't changed."
        confirmLabel="Remove"
        cancelLabel="Keep"
        busy={removeBusy}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </>
  );
}

const toYmd = (d) => d.toLocaleDateString("en-CA");

function seed(view, flare, today) {
  if (view === "ease") {
    return {
      id: flare?.id,
      startDate: flare?.startDate || today,
      endDate: today,
      note: flare?.note || "",
      stillGoing: false,
    };
  }
  if (view === "edit" && flare) {
    return {
      id: flare.id,
      startDate: flare.startDate,
      endDate: flare.endDate || today,
      note: flare.note || "",
      stillGoing: !flare.endDate,
    };
  }
  return { id: null, startDate: today, endDate: today, note: "", stillGoing: view === "start" };
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
  list: { gap: 8, paddingTop: 4 },
  listError: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.85)" },
  row: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  rowRange: { fontFamily: "Lato_400Regular", fontSize: 15, color: "white" },
  rowNote: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  rowActions: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
  rowBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  rowBtnText: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)" },

  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  dateText: { fontFamily: "Lato_400Regular", fontSize: 15, color: "white" },
  inlinePicker: { marginTop: 8, alignItems: "center" },
  pickerDone: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  pickerDoneText: { fontFamily: "Lato_700Bold", fontSize: 15, color: "white" },

  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    marginTop: 14,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boxChecked: { backgroundColor: "white", borderColor: "white" },
  tick: { color: PRIMARY, fontSize: 13, fontWeight: "700", lineHeight: 16 },
  checkLabel: { fontFamily: "Lato_400Regular", fontSize: 14, color: "rgba(255,255,255,0.8)", flexShrink: 1 },

  noteInput: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 64,
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "white",
    textAlignVertical: "top",
  },
  counter: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textAlign: "right",
    marginTop: 4,
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
  closeText: { fontFamily: "Lato_400Regular", fontSize: 15, color: "rgba(255,255,255,0.7)" },
  addBtn: {
    backgroundColor: "white",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  addText: { fontFamily: "Lato_700Bold", fontSize: 15, color: PRIMARY },
});

export { PLUM };
