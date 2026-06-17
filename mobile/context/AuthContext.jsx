import { createContext, useContext, useEffect, useState } from "react";
import api, { setOnUnauthorized } from "../lib/api";
import {
  getToken as loadToken,
  setToken as saveToken,
  getUser as loadUser,
  setUser as saveUser,
  clearAuth,
} from "../lib/storage";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function signOut() {
    await clearAuth();
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    // Register the 401 handler before any requests fire
    setOnUnauthorized(() => signOut());

    async function hydrate() {
      try {
        const storedToken = await loadToken();
        const storedUser = await loadUser();
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          // Optimistic restore — verify in background; sign out if token is dead
          api.get("/api/protected").catch(() => signOut());
        }
      } finally {
        setIsLoading(false);
      }
    }

    hydrate();
  }, []);

  async function signIn(email, password) {
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { token: newToken, user: newUser } = res.data;
      await saveToken(newToken);
      await saveUser(newUser);
      setToken(newToken);
      setUser(newUser);
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

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
