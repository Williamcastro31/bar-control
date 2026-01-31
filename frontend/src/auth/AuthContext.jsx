import React, { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const nome = localStorage.getItem("nome");
    const userId = localStorage.getItem("user_id");
    return token ? { token, role, nome, userId: userId ? Number(userId) : null } : null;
  });

  const value = useMemo(() => ({
    user,
    login: ({ token, role, nome, userId }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("nome", nome);
      if (userId !== undefined && userId !== null) {
        localStorage.setItem("user_id", String(userId));
      }
      setUser({ token, role, nome, userId: userId ?? null });
    },
    logout: () => {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("nome");
      localStorage.removeItem("user_id");
      setUser(null);
    }
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
