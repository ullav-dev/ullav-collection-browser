"use client";

// The note title/body search box `ResearchPage.tsx`'s old hand-rolled notes
// UI had (backed by cartlann's own `GET /research-notes/search`, itself
// backed by tack-server's hybrid search once a note's data lives there --
// see tack-notes-adapter.ts's own doc comment on why cartlann's endpoints
// are called directly rather than through the adapter for this: `TackNotesApi`
// has no `search` method at all, this is a purely cartlann-side feature with
// no tack-notes equivalent).
//
// `TackNotesPanel` has no concept of "jump to an arbitrary note found by
// search" once already mounted -- `initialSelectedNoteId` is consumed once,
// at mount, by design (same contract as `initialDraft`). So a result click
// here navigates to `/research?noteId=X` (exactly what an object's own
// "View note" link already does) rather than trying to reach into an
// already-mounted panel; `ResearchPage` remounts `TackNotesPanel` with a
// `key` derived from `noteId` specifically to make that work.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { searchNotes, type ResearchNote } from "@/lib/collection-api";

interface Props {
  token: string;
  onSelectNote: (noteId: string) => void;
}

export default function CartlannNoteSearch({ token, onSelectNote }: Props) {
  const t = useTranslations("notes");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResearchNote[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchNotes(token, query.trim())
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, token]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function select(note: ResearchNote) {
    // A reply's own title is always empty -- link to its parent thread,
    // same convention Tack's own search results UI uses.
    onSelectNote(note.parent_id ?? note.id);
    setQuery("");
    setResults(null);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-xs">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("searchPlaceholder")}
        className="box-border w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 focus:border-[var(--tnotes-500,#f43f5e)] focus:outline-none focus:ring-1 focus:ring-[var(--tnotes-500,#f43f5e)]"
      />

      {open && query.trim() && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-30 py-1 max-h-80 overflow-y-auto">
          {searching ? (
            <p className="text-xs text-slate-400 px-3 py-2">{t("loading")}</p>
          ) : !results || results.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-2">{t("searchNoResults")}</p>
          ) : (
            results.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => select(note)}
                className="w-full text-left px-3 py-2 hover:bg-[var(--tnotes-50,#fff1f2)] transition-colors"
              >
                <div className="text-xs font-medium text-slate-800 truncate">
                  {note.parent_id ? t("searchInReply") : note.title || t("untitled")}
                </div>
                {(note.description || note.body) && (
                  <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{note.description || note.body}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
