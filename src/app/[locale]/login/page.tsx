"use client";

import { useState, useEffect } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { register, requestPasswordReset } from "@/lib/auth-api";
import PasswordInput from "@/components/PasswordInput";

type Tab = "login" | "register";
type Stage = "form" | "verify-email" | "reset-request";

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm w-full focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

function TaisceIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="32" fill="#0D9488"/>
      <rect x="10" y="38" width="44" height="6" rx="2" fill="#CCFBF1"/>
      <rect x="16" y="20" width="8" height="18" rx="2" fill="#F0FDFA"/>
      <rect x="28" y="16" width="8" height="22" rx="2" fill="#CCFBF1"/>
      <rect x="40" y="22" width="8" height="16" rx="2" fill="#F0FDFA"/>
      <circle cx="48" cy="18" r="5" fill="#D97706"/>
    </svg>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function SubmitButton({ loading, disabled, label }: { loading: boolean; disabled?: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
    >
      {loading ? "Please wait…" : label}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
      {message}
    </div>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : "";
  if (/^HTTP 5/.test(msg)) return "Server error. Please try again later.";
  return msg || fallback;
}

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("login");
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/");
  }, [isLoading, user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err, "Sign in failed. Check your credentials."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (regPassword !== regConfirm) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      await register(regUsername, regEmail, regPassword, window.location.origin);
      setPendingEmail(regEmail);
      setStage("verify-email");
    } catch (err) {
      setError(errorMessage(err, "Registration failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(resetEmail, window.location.origin);
      setResetSent(true);
    } catch (err) {
      setError(errorMessage(err, "Could not send reset link. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return null;

  if (stage === "verify-email") {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="font-bold text-lg text-slate-800 mb-2">Check your email</h1>
          <p className="text-sm text-slate-600 mb-6">
            We sent a confirmation link to <strong>{pendingEmail}</strong>.
          </p>
          {error && <ErrorBox message={error} />}
          <button
            type="button"
            onClick={() => { setStage("form"); setTab("login"); setError(null); }}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (stage === "reset-request") {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8">
          <div className="flex items-center gap-2 mb-6">
            <TaisceIcon />
            <span className="font-bold text-lg text-slate-800">Reset password</span>
          </div>
          {error && <ErrorBox message={error} />}
          {resetSent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <p className="text-sm text-slate-600">
                If an account exists for that email, a reset link has been sent.
              </p>
              <button
                type="button"
                onClick={() => { setStage("form"); setError(null); setResetSent(false); }}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <Field label="Email address" htmlFor="reset-email">
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoFocus
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <SubmitButton loading={submitting} label="Send reset link" />
              <button
                type="button"
                onClick={() => { setStage("form"); setError(null); }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <TaisceIcon />
          <span className="font-bold text-lg text-slate-800">Taisce</span>
        </div>

        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {(["login", "register"] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => { setTab(tabKey); setError(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === tabKey
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tabKey === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {error && <ErrorBox message={error} />}

        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email" htmlFor="login-email">
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <PasswordInput
                id="login-password"
                required
                value={loginPassword}
                onChange={setLoginPassword}
              />
            </Field>
            <SubmitButton loading={submitting} label="Sign in" />
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setStage("reset-request"); setError(null); }}
                className="text-sm text-slate-500 hover:text-teal-700 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="Username" htmlFor="reg-username">
              <input
                id="reg-username"
                required
                autoFocus
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className={inputCls}
                placeholder="your_username"
              />
            </Field>
            <Field label="Email" htmlFor="reg-email">
              <input
                id="reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Password" htmlFor="reg-password">
              <PasswordInput
                id="reg-password"
                required
                minLength={8}
                value={regPassword}
                onChange={setRegPassword}
                placeholder="Min 8 characters"
              />
            </Field>
            <Field label="Confirm password" htmlFor="reg-confirm">
              <PasswordInput
                id="reg-confirm"
                required
                value={regConfirm}
                onChange={setRegConfirm}
              />
            </Field>
            <SubmitButton
              loading={submitting}
              disabled={!regUsername || !regEmail || !regPassword || !regConfirm}
              label="Create account"
            />
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/browse" className="hover:text-slate-600 transition-colors">
            Browse the public collection →
          </Link>
        </p>
      </div>
    </div>
  );
}
