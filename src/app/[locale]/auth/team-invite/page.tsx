"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import { acceptTeamInvite, declineTeamInvite } from "@/lib/auth-api";

// ── Inner component (needs Suspense for useSearchParams) ──────────────────────

function TeamInviteInner() {
  const { token, user, setSession, isLoading: authLoading } = useAuth();
  const { refresh } = useCollection();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();

  const inviteToken = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "accepting" | "accepted" | "declined" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated, preserving the invite URL.
  useEffect(() => {
    if (!authLoading && !user) {
      const returnUrl = encodeURIComponent(`/${locale}/auth/team-invite${window.location.search}`);
      router.replace(`/${locale}/login?returnUrl=${returnUrl}`);
    }
  }, [authLoading, user, locale, router]);

  if (!inviteToken) {
    return (
      <div className="max-w-sm mx-auto py-24 text-center space-y-4">
        <p className="text-slate-500 text-sm">This invitation link is invalid or has expired.</p>
        <Link href="/" className="text-sm text-teal-600 hover:underline">Go to home</Link>
      </div>
    );
  }

  async function handleAccept() {
    if (!token) return;
    setStatus("accepting");
    setError(null);
    try {
      const result = await acceptTeamInvite(token, inviteToken!);
      // UUM returns a fresh JWT with the new team membership baked in.
      if (result.token) {
        // Update the stored session so CollectionContext sees the new teams claim.
        setSession({ token: result.token, user: user!, roles: [] });
      }
      await refresh();
      setStatus("accepted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const wrongAccount = /insufficient.permissions|forbidden|403/i.test(msg);
      setError(
        wrongAccount
          ? `This invitation was sent to a different email. You are signed in as ${user?.email ?? user?.username}. Please sign in with the account that received the invitation.`
          : (msg || "Failed to accept invitation. Please try again.")
      );
      setStatus("error");
    }
  }

  async function handleDecline() {
    if (!token) return;
    try {
      await declineTeamInvite(token, inviteToken!);
    } catch {
      // Decline failure is non-fatal
    }
    setStatus("declined");
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm animate-pulse">
        Loading…
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div className="max-w-sm mx-auto py-24 text-center space-y-5">
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">You&apos;re in!</h1>
          <p className="text-slate-500 text-sm mt-1">You have joined the team. Your collection access is now active.</p>
        </div>
        <Link
          href="/objects"
          className="inline-flex items-center bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Open collection →
        </Link>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="max-w-sm mx-auto py-24 text-center space-y-4">
        <p className="text-slate-500 text-sm">You have declined the invitation.</p>
        <Link href="/" className="text-sm text-teal-600 hover:underline">Go to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-24 text-center space-y-6">
      <div className="w-16 h-16 bg-teal-50 border-2 border-teal-200 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-slate-800">Team invitation</h1>
        <p className="text-slate-500 text-sm">You have been invited to join a Cartlann team. Accept to gain access to the shared collection.</p>
      </div>

      <p className="text-xs text-slate-400">
        Signed in as <span className="font-medium text-slate-600">{user.email ?? user.username}</span>.
        Make sure this matches the email address the invitation was sent to.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 justify-center">
        <button
          type="button"
          onClick={handleDecline}
          disabled={status === "accepting"}
          className="px-5 py-2.5 border border-slate-300 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={status === "accepting"}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
        >
          {status === "accepting" ? "Accepting…" : "Accept invitation"}
        </button>
      </div>
    </div>
  );
}

// ── Page (Suspense boundary for useSearchParams) ──────────────────────────────

export default function TeamInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm animate-pulse">
          Loading…
        </div>
      }
    >
      <TeamInviteInner />
    </Suspense>
  );
}
