import { createContext, useState, useEffect } from "react";
import { setAnalyticsToken, trackSession } from "../lib/analytics";

const INACTIVITY_MS = 14 * 24 * 60 * 60 * 1000;

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem("token", tokenData);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("lastActive", Date.now().toString());
    setAnalyticsToken(tokenData);
    trackSession();
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAnalyticsToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("lastActive");
  };

  const updateUser = (newUserData) => {
    setUser(newUserData);
    localStorage.setItem("user", JSON.stringify(newUserData));
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const lastActive = localStorage.getItem("lastActive");

    if (savedToken && lastActive) {
      const inactive = Date.now() - parseInt(lastActive, 10);
      if (inactive > INACTIVITY_MS) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("lastActive");
      } else {
        setToken(savedToken);
        setUser(JSON.parse(localStorage.getItem("user")));
        localStorage.setItem("lastActive", Date.now().toString());
        setAnalyticsToken(savedToken);
        trackSession();
      }
    }
    setLoading(false);
  }, []);

  // passing user, token, login and logout into the context
  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, updateUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}
