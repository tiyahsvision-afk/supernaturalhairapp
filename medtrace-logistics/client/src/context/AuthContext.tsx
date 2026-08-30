import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "../lib/api";
import type { User, Company } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  joinCompany: (joinCode: string) => Promise<Company>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api<{ user: User }>("/auth/me");
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(token);
    setUser(user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { token, user } = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    setToken(token);
    setUser(user);
  }, []);

  const joinCompany = useCallback(async (joinCode: string) => {
    const { token, user, company } = await api<{ token: string; user: User; company: Company }>(
      "/auth/join-company",
      { method: "POST", body: { join_code: joinCode } }
    );
    setToken(token);
    setUser(user);
    return company;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, joinCompany, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
