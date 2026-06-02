// Typed wrappers for ullav-user-management.
//
// Login goes via the collection server's /auth/login proxy (proxied in the browser
// as /api/auth/login) so that UUM stays off the public internet.
// All other auth calls (register, confirm-email, password-reset) go directly to
// UUM via the /auth-api/* Next.js rewrite.

const UUM_BASE =
  typeof window === "undefined"
    ? (process.env.AUTH_URL ?? "http://localhost:8081")
    : "/auth-api";

// Collection server login proxy — browser uses /api rewrite, server uses direct URL.
const LOGIN_BASE =
  typeof window === "undefined"
    ? (process.env.API_URL ?? "http://localhost:8084")
    : "/api";

// Keep original BASE alias for non-login calls.
const BASE = UUM_BASE;

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  roles: string[];
  permissions: string[];
}

export interface RegisterResponse {
  message: string;
  confirmation_token: string;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (res.status === 204 || !contentType.includes("application/json")) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return undefined as T;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? data.message ?? data.detail ?? `HTTP ${res.status}`);
  return data as T;
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function decodePermissions(token: string | null): string[] {
  if (!token) return [];
  const payload = decodePayload(token);
  if (!payload) return [];
  return (payload.permissions ?? []) as string[];
}

export function hasPermission(token: string | null, permission: string): boolean {
  const perms = decodePermissions(token);
  const roles = token ? ((decodePayload(token)?.roles ?? []) as string[]) : [];
  return roles.includes("admin") || perms.includes(permission);
}

export const login = (email: string, password: string): Promise<LoginResponse> => {
  // Route through the collection server's auth proxy, not UUM directly.
  const url = `${LOGIN_BASE}/auth/login`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`);
    return data as LoginResponse;
  });
};

export const register = (
  username: string,
  email: string,
  password: string,
  app_url?: string
): Promise<RegisterResponse> =>
  authRequest("/users", {
    method: "POST",
    body: JSON.stringify({ username, email, password, ...(app_url ? { app_url } : {}) }),
  });

export const confirmEmail = (token: string): Promise<void> =>
  authRequest("/auth/confirm-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const requestPasswordReset = (
  email: string,
  app_url?: string
): Promise<{ reset_token?: string; message?: string }> =>
  authRequest("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email, ...(app_url ? { app_url } : {}) }),
  });

export const confirmPasswordReset = (token: string, new_password: string): Promise<void> =>
  authRequest("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password }),
  });

export const changePassword = (
  userId: string,
  newPassword: string,
  currentPassword: string | undefined,
  bearerToken: string
): Promise<void> =>
  authRequest(`/users/${userId}/password`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify({ new_password: newPassword, current_password: currentPassword }),
  });
