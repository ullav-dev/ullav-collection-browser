"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { confirmEmail } from "@/lib/auth-api";

export default function ConfirmEmailPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("Missing confirmation token.");
      return;
    }
    confirmEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Confirmation failed.");
      });
  }, [searchParams]);

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
        {status === "pending" && <p className="text-slate-500 text-sm">Confirming your email…</p>}
        {status === "success" && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="font-bold text-lg text-slate-800 mb-2">Email confirmed</h1>
            <p className="text-sm text-slate-600 mb-6">Your account is now active.</p>
            <Link href="/login" className="inline-block bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              Sign in
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="font-bold text-lg text-slate-800 mb-2">Confirmation failed</h1>
            <p className="text-sm text-slate-600 mb-6">{errorMsg}</p>
            <Link href="/login" className="text-sm text-teal-600 hover:text-teal-700 transition-colors">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
