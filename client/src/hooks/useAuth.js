import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

// custom hook that gives any component easy access to auth state
export function useAuth() {
  return useContext(AuthContext);
}
