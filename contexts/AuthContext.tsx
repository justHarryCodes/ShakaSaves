"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { clientAuth, onIdTokenChanged, getIdToken, type User } from "@/lib/client-auth";

interface AuthContextValue {
  user: User | null;
  role: "admin" | "customer" | null;
  loading: boolean;
  idToken: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  loading: true,
  idToken: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "customer" | null>(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onIdTokenChanged(clientAuth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdToken();
        setIdToken(token);
        const result = await u.getIdTokenResult();
        setRole((result.claims.role as "admin" | "customer") ?? null);
      } else {
        setIdToken(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, idToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
