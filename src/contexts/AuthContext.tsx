"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { AuthUser, LoginResponse } from "@/lib/auth-api";
import { login as apiLogin } from "@/lib/auth-api";

/** Decode the permissions array from a JWT payload without verifying signature (server enforces). */
function permissionsFromToken(token: string): string[] {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Array.isArray(payload.permissions) ? payload.permissions : [];
  } catch {
    return [];
  }
}

export interface SessionPayload {
  token: string;
  user: AuthUser;
  roles: string[];
  /** Optional — derived from the JWT if omitted (SSO payloads don't include it). */
  permissions?: string[];
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  roles: string[];
  permissions: string[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  setSession: (session: SessionPayload) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  roles: [],
  permissions: [],
  isLoading: true,
  login: async () => { throw new Error("AuthProvider not mounted"); },
  logout: () => {},
  setSession: () => {},
});

const STORAGE_KEY = "cartlann_auth";

const IDLE_MS = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS ?? 3_600_000);
const WARN_BEFORE_MS = 60_000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "pointerdown",
  "scroll",
  "touchstart",
] as const;

function IdleWarningModal({ onStay, onLogout }: { onStay: () => void; onLogout: () => void }) {
  const [seconds, setSeconds] = useState(Math.round(WARN_BEFORE_MS / 1000));

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-semibold text-slate-800 mb-2">Session expiring</h2>
        <p className="text-sm text-slate-600 mb-5">
          You will be signed out in {seconds} seconds due to inactivity.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Sign out now
          </button>
          <button
            type="button"
            onClick={onStay}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white transition-colors"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleWarningRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { user: AuthUser; token: string; roles?: string[]; permissions?: string[] };
        if (!parsed.roles) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          setUser(parsed.user);
          setToken(parsed.token);
          setRoles(parsed.roles);
          setPermissions(parsed.permissions ?? []);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRoles([]);
    setPermissions([]);
    setIdleWarning(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setSession = useCallback((session: SessionPayload) => {
    const permissions = session.permissions ?? permissionsFromToken(session.token);
    setUser(session.user);
    setToken(session.token);
    setRoles(session.roles);
    setPermissions(permissions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, permissions }));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    const resp = await apiLogin(email, password);
    setSession({ user: resp.user, token: resp.token, roles: resp.roles, permissions: resp.permissions });
    return resp;
  }, [setSession]);

  const startTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    idleWarningRef.current = false;
    setIdleWarning(false);

    if (IDLE_MS > WARN_BEFORE_MS) {
      warnTimerRef.current = setTimeout(() => {
        idleWarningRef.current = true;
        setIdleWarning(true);
      }, IDLE_MS - WARN_BEFORE_MS);
    }

    logoutTimerRef.current = setTimeout(() => {
      idleWarningRef.current = false;
      setIdleWarning(false);
      logout();
    }, IDLE_MS);
  }, [logout]);

  const handleActivity = useCallback(() => {
    if (!idleWarningRef.current) startTimers();
  }, [startTimers]);

  useEffect(() => {
    if (!user) {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      return;
    }
    startTimers();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [user, startTimers, handleActivity]);

  return (
    <AuthContext.Provider value={{ user, token, roles, permissions, isLoading, login, logout, setSession }}>
      {children}
      {idleWarning && <IdleWarningModal onStay={startTimers} onLogout={logout} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
