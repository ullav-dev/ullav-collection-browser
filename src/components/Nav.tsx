"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import UserAvatar, { userDisplayName } from "@/components/UserAvatar";
import AboutModal from "@/components/AboutModal";

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
  const { activeCollection, collections, teams, userRole, switchCollection } = useCollection();
  const t = useTranslations("nav");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const collectionRef = useRef<HTMLDivElement>(null);

  const openComad = useCallback(() => {
    if (!token || !user) return;
    const damBrowserUrl = (window as unknown as Record<string, Record<string, string>>).__ENV__?.DAM_BROWSER_URL ?? "https://comad.ullav.com";
    const session = encodeURIComponent(JSON.stringify({ token, user, roles }));
    // Named target reuses the tab if it's already open; noopener for security.
    window.open(`${damBrowserUrl}/${locale}/auth/sso?t=${session}`, COMAD_WINDOW_NAME, "noopener");
  }, [token, user, roles, locale]);

  useEffect(() => {
    if (!dropdownOpen && !collectionOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (collectionRef.current && !collectionRef.current.contains(e.target as Node)) {
        setCollectionOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, collectionOpen]);

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
          {/* Logo + collection switcher */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <CartlannIcon />
              <span className="font-bold text-lg text-slate-800 tracking-tight">Cartlann</span>
            </Link>

            {/* Collection switcher — only shown when logged in with >0 collections */}
            {user && collections.length > 0 && (
              <div className="relative" ref={collectionRef}>
                <button
                  type="button"
                  onClick={() => setCollectionOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 text-sm font-medium text-slate-700 transition-colors max-w-[180px]"
                  title="Switch collection"
                >
                  <svg className="w-3.5 h-3.5 text-teal-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="truncate">{activeCollection?.name ?? "Collection"}</span>
                  <svg className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${collectionOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {collectionOpen && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    {/* Group collections by team */}
                    {teams.length > 1
                      ? teams.map((team) => {
                          const teamCollections = collections.filter((c) => c.team_id === team.id);
                          if (teamCollections.length === 0) return null;
                          return (
                            <div key={team.id}>
                              <p className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">{team.name}</p>
                              {teamCollections.map((c) => (
                                <CollectionItem key={c.id} collection={c} active={c.id === activeCollection?.id} onSelect={() => { switchCollection(c.id); setCollectionOpen(false); }} />
                              ))}
                            </div>
                          );
                        })
                      : collections.map((c) => (
                          <CollectionItem key={c.id} collection={c} active={c.id === activeCollection?.id} onSelect={() => { switchCollection(c.id); setCollectionOpen(false); }} />
                        ))
                    }
                    {userRole === "admin" && (
                      <>
                        <div className="my-1 border-t border-slate-100" />
                        <Link
                          href="/settings?tab=collections"
                          onClick={() => setCollectionOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          New collection
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="flex items-center gap-4">
            {!isLoading && user ? (
              <>
                <Link href="/objects" className={navLink("/objects")}>{t("collection")}</Link>
                <Link href="/locations" className={navLink("/locations")}>{t("locations")}</Link>
                <Link href="/entries" className={navLink("/entries")}>{t("entries")}</Link>
                <Link href="/acquisitions" className={navLink("/acquisitions")}>{t("acquisitions")}</Link>
                <Link href="/research" className={navLink("/research")}>{t("research")}</Link>

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
                      <DropdownLink href="/parties" onClick={() => setDropdownOpen(false)}>{t("parties")}</DropdownLink>
                      <DropdownLink href="/settings" onClick={() => setDropdownOpen(false)}>Settings</DropdownLink>
                      <DropdownButton onClick={() => { setDropdownOpen(false); setAboutOpen(true); }}>{t("about")}</DropdownButton>
                      <div className="my-1 border-t border-slate-100" />
                      <DropdownButton onClick={handleLogout} destructive>{t("signOut")}</DropdownButton>
                    </div>
                  )}
                </div>
                {aboutOpen && <AboutModal user={user} onClose={() => setAboutOpen(false)} />}
              </>
            ) : !isLoading ? (
              <>
                <Link href="/browse" className={navLink("/browse")}>{t("browse")}</Link>
                <Link
                  href="/login"
                  className={`text-sm font-medium px-4 py-1.5 rounded-lg border transition-colors ${
                    pathname === "/login"
                      ? "border-teal-600 text-teal-700 bg-teal-50"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t("signIn")}
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

function CollectionItem({ collection, active, onSelect }: { collection: { id: string; name: string; description: string | null }; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        active ? "bg-teal-50 text-teal-800 font-medium" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <div className="min-w-0 text-left">
        <p className="truncate leading-tight">{collection.name}</p>
        {collection.description && (
          <p className="text-xs text-slate-400 font-normal truncate">{collection.description}</p>
        )}
      </div>
      {active && <span className="ml-auto text-teal-600 text-xs shrink-0">✓</span>}
    </button>
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
