"use client";

// SSO handoff page — called by ullav-portal when launching Taisce.
// URL format: /en/auth/sso?t=<encoded-session>
//
// The encoded session is URL-encoded JSON: { token, user, roles }
// Permissions are derived from the JWT payload by setSession().

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import type { AuthUser } from "@/lib/auth-api";
import { useAuth } from "@/contexts/AuthContext";

function SsoHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSession } = useAuth();

  useEffect(() => {
    const raw = searchParams.get("t");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const session = JSON.parse(decodeURIComponent(raw)) as {
        token: string;
        user: AuthUser;
        roles: string[];
      };
      if (!session.token || !session.user || !session.roles) throw new Error("invalid payload");
      setSession(session);
      router.replace("/");
    } catch {
      router.replace("/login");
    }
  }, [searchParams, router, setSession]);

  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-slate-400 text-sm">Signing you in…</p>
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-400 text-sm">Signing you in…</p>
      </div>
    }>
      <SsoHandler />
    </Suspense>
  );
}
