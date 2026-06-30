"use client";

import { useRef, useEffect, useState } from "react";
import { useCollection } from "@/contexts/CollectionContext";

export default function TeamSwitcher() {
  const { teams, activeTeam, collections, switchCollection } = useCollection();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Only show when the user has collections in more than one team.
  const teamIds = [...new Set(collections.map((c) => c.team_id))];
  const relevantTeams = teams.filter((t) => teamIds.includes(t.id));
  if (relevantTeams.length < 2) return null;

  function switchToTeam(teamId: string) {
    const first = collections.find((c) => c.team_id === teamId);
    if (first) switchCollection(first.id);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Switch team"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 text-sm font-medium text-slate-600 transition-colors"
      >
        <TeamIcon />
        <span className="max-w-[7rem] truncate">{activeTeam?.name ?? "Team"}</span>
        <svg className={`w-3 h-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
          <p className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Switch team</p>
          {relevantTeams.map((team) => {
            const count = collections.filter((c) => c.team_id === team.id).length;
            const active = team.id === activeTeam?.id;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => switchToTeam(team.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                  active ? "bg-teal-50 text-teal-800 font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <TeamIcon className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                <span className="flex-1 truncate text-left">{team.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{count} {count === 1 ? "collection" : "collections"}</span>
                {active && (
                  <svg className="shrink-0 w-3.5 h-3.5 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamIcon({ className = "w-4 h-4 text-teal-500" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
