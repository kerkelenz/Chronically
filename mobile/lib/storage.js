import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";           // AsyncStorage (no size cap — stores full user with avatar)
const SECURE_USER_KEY = "auth_user";    // legacy SecureStore key used before this refactor
const PUSH_TOKEN_KEY = "push_token";
const PUSH_DECLINED_KEY = "push_declined";  // survives sign-out: a "no" should stick

// ── Token (SecureStore — sensitive) ──────────────────────────────────────────

export async function getToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token) {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {}
}

// ── User (AsyncStorage — no size cap, avatar included) ────────────────────────

export async function getUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setUser(obj) {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(obj));
  } catch {}
}

// ── Migration (run once on first boot after this refactor) ───────────────────
// Reads the old SecureStore user entry, writes it to AsyncStorage, deletes from SecureStore.

export async function migrateUserFromSecureStore() {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    await AsyncStorage.setItem(USER_KEY, raw);
    await SecureStore.deleteItemAsync(SECURE_USER_KEY);
    return u;
  } catch {
    return null;
  }
}

// ── Push notifications ───────────────────────────────────────────────────────
// The Expo push token is kept so sign-out knows exactly which row to unregister
// server-side; "declined" remembers that the user said Not now to the priming
// card, so the app never asks again on its own (Profile can still turn it on).

export async function getPushToken() {
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setPushToken(token) {
  try {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  } catch {}
}

export async function clearPushToken() {
  try {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {}
}

export async function getPushDeclined() {
  try {
    return (await AsyncStorage.getItem(PUSH_DECLINED_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setPushDeclined(declined) {
  try {
    await AsyncStorage.setItem(PUSH_DECLINED_KEY, declined ? "true" : "false");
  } catch {}
}

// ── Clear both stores ─────────────────────────────────────────────────────────

export async function clearAuth() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {}
}
