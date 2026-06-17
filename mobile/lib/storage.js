import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";           // AsyncStorage (no size cap — stores full user with avatar)
const SECURE_USER_KEY = "auth_user";    // legacy SecureStore key used before this refactor

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

// ── Clear both stores ─────────────────────────────────────────────────────────

export async function clearAuth() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  } catch {}
}
