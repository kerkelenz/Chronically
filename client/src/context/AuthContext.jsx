import { createContext, useState, useEffect } from "react";

// creating the context object - this is what other components import to access auth state
export const AuthContext = createContext();

// AuthProvider wraps the whole app and makes auth state available everywhere
// children means whatever components are nested inside it
export function AuthProvider({ children }) {
  // user holds the logged in user's info (id, username, email)
  // token holds the JWT token we got back from the server
  // both start as null because nobody is logged in yet
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // we save to both state and localStorage so they stay logged in on refresh
  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem("token", tokenData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  // logout clears everything - state and localStorage
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const updateUser = (newUserData) => {
    setUser(newUserData);
    localStorage.setItem("user", JSON.stringify(newUserData));
  };

  // this runs once when the app first loads
  // if there's a saved token in localStorage the session gets restored
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      setUser(JSON.parse(localStorage.getItem("user")));
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
