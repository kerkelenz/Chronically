import { createContext, useContext } from "react";

// The context lives here rather than beside the provider: a file that exports
// both a component and a plain value loses fast refresh, and the hook is the
// only thing that ever reads this. AuthContext.jsx imports it to provide it.
export const AuthContext = createContext();

// custom hook that gives any component easy access to auth state
export function useAuth() {
  return useContext(AuthContext);
}
