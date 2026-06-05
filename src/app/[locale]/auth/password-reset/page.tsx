"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { confirmPasswordReset } from "@/lib/auth-api";
import PasswordInput from "@/components/PasswordInput";

export default function PasswordResetPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
          <p className="text-slate-500 text-sm mb-4">Invalid reset link.</p>
          <Link href="/login" className="text-teal-600 hover:text-teal-700 text-sm">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8">
        <h1 className="font-bold text-lg text-slate-800 mb-6">Set new password</h1>

        {done ? (
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm text-slate-600">Password updated. Redirecting…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="pw" className="text-sm font-medium text-slate-700">New password</label>
              <PasswordInput id="pw" required minLength={8} value={password} onChange={setPassword} placeholder="Min 8 characters" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm" className="text-sm font-medium text-slate-700">Confirm password</label>
              <PasswordInput id="confirm" required value={confirm} onChange={setConfirm} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {submitting ? "Updating…" : "Set password"}
            </button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
