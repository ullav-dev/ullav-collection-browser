"use client";

import { useTranslations } from "next-intl";
import type { AuthUser } from "@/lib/auth-api";

function CartlannIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="32" fill="#0D9488"/>
      <rect x="10" y="38" width="44" height="6" rx="2" fill="#CCFBF1"/>
      <rect x="16" y="20" width="8" height="18" rx="2" fill="#F0FDFA"/>
      <rect x="28" y="16" width="8" height="22" rx="2" fill="#CCFBF1"/>
      <rect x="40" y="22" width="8" height="16" rx="2" fill="#F0FDFA"/>
      <circle cx="48" cy="18" r="5" fill="#D97706"/>
    </svg>
  );
}

interface Props {
  user: AuthUser | null;
  onClose: () => void;
}

export default function AboutModal({ user, onClose }: Props) {
  const t = useTranslations("about");

  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? "dev";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-teal-600 px-6 py-5 flex items-center gap-4">
          <CartlannIcon />
          <div>
            <p className="font-bold text-xl text-white leading-tight">Cartlann</p>
            <p className="text-teal-100 text-sm">{t("tagline")}</p>
          </div>
        </div>

        {/* Info */}
        <div className="px-6 py-5">
          <dl className="divide-y divide-slate-100">
            <Row label={t("version")} value={`v${version}`} mono={false} />
            <Row label={t("build")} value={gitSha} mono />
            {user && (
              <Row label={t("user")} value={user.username} mono={false} />
            )}
            <EmailRow label={t("support")} email="support@ullav.com" />
            <EmailRow label={t("contact")} email="info@ullav.com" />
          </dl>
        </div>

        {/* Close */}
        <div className="px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <dt className="text-sm text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-sm font-medium text-slate-800 truncate text-right ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function EmailRow({ label, email }: { label: string; email: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <dt className="text-sm text-slate-500 shrink-0">{label}</dt>
      <dd className="text-sm text-right">
        <a href={`mailto:${email}`} className="font-medium text-teal-600 hover:underline">{email}</a>
      </dd>
    </div>
  );
}
