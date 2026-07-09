import { createContext, useContext, useEffect, useState } from "react";
import api, { setOnUnauthorized } from "../lib/api";
import { trackSession } from "../lib/analytics";
import {
  getToken as loadToken,
  setToken as saveToken,
  getUser as loadUser,
  setUser as saveUser,
  clearAuth,
  migrateUserFromSecureStore,
} from "../lib/storage";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function signOut() {
    await clearAuth();
    setToken(null);
    setUserState(null);
  }

  useEffect(() => {
    setOnUnauthorized(() => signOut());

    async function hydrate() {
      const storedToken = await loadToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      // User now lives in AsyncStorage; migrate from SecureStore on first boot after refactor
      let u = await loadUser();
      if (!u) u = await migrateUserFromSecureStore();
      if (!u) {
        // Token exists but no user record — require fresh login
        await signOut();
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      setUserState(u);
      trackSession();
      // Optimistic restore — validate token in background
      api.get("/api/protected").catch(() => signOut());
      setIsLoading(false);
    }

    hydrate();
  }, []);

  async function signIn(email, password) {
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { token: newToken, user: newUser } = res.data;
      await saveToken(newToken);
      await saveUser(newUser); // full user including avatar → AsyncStorage
      setToken(newToken);
      setUserState(newUser);
      trackSession();
    } catch (err) {
      const msg =
        err.response?.data?.error || "Something went wrong. Please try again.";
      throw new Error(msg);
    }
  }

  async function signUp(username, email, password) {
    try {
      const res = await api.post("/api/auth/register", {
        username,
        email,
        password,
      });
      return res.data.message;
    } catch (err) {
      const msg =
        err.response?.data?.error || "Something went wrong. Please try again.";
      throw new Error(msg);
    }
  }

  // Used by Phase 7b (account editing) to update both state and the AsyncStorage cache
  async function updateUser(next) {
    setUserState(next);
    await saveUser(next);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, signIn, signUp, signOut, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
