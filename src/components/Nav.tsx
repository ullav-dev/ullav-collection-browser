"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import UserAvatar, { userDisplayName } from "@/components/UserAvatar";

// Named window target — browser reuses the same tab if it's already open.
const COMAD_WINDOW_NAME = "cartlann_comad";

// Cartlann SVG logo — teal archive/collection motif
function CartlannIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="32" fill="#0D9488"/>
      {/* Shelf / archive tray */}
      <rect x="10" y="38" width="44" height="6" rx="2" fill="#CCFBF1"/>
      {/* Three upright objects representing a collection */}
      <rect x="16" y="20" width="8" height="18" rx="2" fill="#F0FDFA"/>
      <rect x="28" y="16" width="8" height="22" rx="2" fill="#CCFBF1"/>
      <rect x="40" y="22" width="8" height="16" rx="2" fill="#F0FDFA"/>
      {/* Accent dot / badge */}
      <circle cx="48" cy="18" r="5" fill="#D97706"/>
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { user, token, roles, isLoading, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const openComad = useCallback(() => {
    if (!token || !user) return;
    const damBrowserUrl = (window as unknown as Record<string, Record<string, string>>).__ENV__?.DAM_BROWSER_URL ?? "https://comad.ullav.com";
    const session = encodeURIComponent(JSON.stringify({ token, user, roles }));
    // Named target reuses the tab if it's already open; noopener for security.
    window.open(`${damBrowserUrl}/${locale}/auth/sso?t=${session}`, COMAD_WINDOW_NAME, "noopener");
  }, [token, user, roles, locale]);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  function handleLogout() {
    setDropdownOpen(false);
    logout();
    router.push("/");
  }

  const navLink = (path: string) =>
    `text-sm font-medium transition-colors ${
      pathname.startsWith(path)
        ? "text-teal-600"
        : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm shrink-0">
      <div className="max-w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <CartlannIcon />
            <span className="font-bold text-lg text-slate-800 tracking-tight">Cartlann</span>
          </Link>

          <nav className="flex items-center gap-4">
            {!isLoading && user ? (
              <>
                <Link href="/objects" className={navLink("/objects")}>
                  Collection
                </Link>
                <Link href="/locations" className={navLink("/locations")}>
                  Locations
                </Link>
                <Link href="/entries" className={navLink("/entries")}>
                  Entries
                </Link>
                <Link href="/acquisitions" className={navLink("/acquisitions")}>
                  Acquisitions
                </Link>

                {/* Comad (DAM) button */}
                <button
                  type="button"
                  onClick={openComad}
                  title="Open Comad media library"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 border border-blue-200 hover:border-blue-300 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="32" fill="#1d4ed8"/>
                    <rect x="10" y="22" width="44" height="30" rx="4" fill="#93c5fd"/>
                    <path d="M10 22 L10 18 Q10 15 13 15 L26 15 Q29 15 30 18 L31 22 Z" fill="#bfdbfe"/>
                    <rect x="16" y="28" width="32" height="18" rx="2" fill="#1e40af"/>
                    <path d="M20 42 L28 32 L34 38 L38 34 L44 42 Z" fill="#60a5fa"/>
                    <circle cx="38" cy="32" r="3" fill="#fbbf24"/>
                  </svg>
                  <span className="hidden sm:block">Comad</span>
                </button>

                {/* User dropdown */}
                <div className="relative pl-3 border-l border-slate-200" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    aria-haspopup="true"
                    aria-expanded={dropdownOpen}
                  >
                    <UserAvatar user={user} size="md" />
                    <span className="hidden sm:block">{userDisplayName(user)}</span>
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M4 6l4 4 4-4H4z" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-50">
                      <DropdownLink href="/parties" onClick={() => setDropdownOpen(false)}>
                        Parties
                      </DropdownLink>
                      <DropdownLink href="/settings" onClick={() => setDropdownOpen(false)}>
                        Settings
                      </DropdownLink>
                      <div className="my-1 border-t border-slate-100" />
                      <DropdownButton onClick={handleLogout} destructive>
                        Sign out
                      </DropdownButton>
                    </div>
                  )}
                </div>
              </>
            ) : !isLoading ? (
              <>
                <Link href="/browse" className={navLink("/browse")}>
                  Browse Collection
                </Link>
                <Link
                  href="/login"
                  className={`text-sm font-medium px-4 py-1.5 rounded-lg border transition-colors ${
                    pathname === "/login"
                      ? "border-teal-600 text-teal-700 bg-teal-50"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Sign in
                </Link>
              </>
            ) : null}
            <LocaleSwitcher />
          </nav>
        </div>
      </div>
    </header>
  );
}

function DropdownLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
    >
      {children}
    </Link>
  );
}

function DropdownButton({ onClick, destructive = false, children }: { onClick: () => void; destructive?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
        destructive ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
