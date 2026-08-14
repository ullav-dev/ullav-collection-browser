"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import { listObjects, type CollectionObject } from "@/lib/collection-api";
import { createCartlannTackNotesApi } from "@/lib/tack-notes-adapter";
import { TackNotesPanel, type Note, type FilterChip } from "@ullav-dev/tack-notes";
import NoteExtraFields, {
  EMPTY_DRAFT,
  renderCartlannDetailBadges,
  cartlannDeleteWarning,
  type NoteExtraDraft,
} from "@/components/notes/CartlannNoteExtra";
import AiChat from "@/components/AiChat";
import WikipediaSearch from "@/components/WikipediaSearch";
import ExplorePanel, { type ExploreSource } from "@/components/ExplorePanel";

// ── Types ─────────────────────────────────────────────────────────────────────

type RightPanel = "notes" | "ai" | "wikipedia" | "explore";

interface Props {
  objectId?: string;
  noteId?: string;
  isNew?: boolean;
}

/** Cartlann's own smart-folder chips, replacing `TackNotesPanel`'s default
 * all/mine/shared bar -- see `tack-notes-adapter.ts`'s own doc comment on
 * per-user scoping. `predicate` only matters for `listMode="entity"`
 * (unused here); in `listMode="team"` (what this page uses), each `key`
 * is sent straight through as `listNotes`'s `filterKey`/`unfiled`, and the
 * adapter itself decides what it means. */
const NOTE_FILTER_CHIPS: (t: ReturnType<typeof useTranslations>) => FilterChip[] = (t) => [
  { key: "all", label: t("folderFilterAll") },
  { key: "unfiled", label: t("chipUnfiled") },
  { key: "shared-by-me", label: t("chipSharedByMe") },
  { key: "shared-by-others", label: t("chipSharedByOthers") },
];

/** Matches this file's own `md:` Tailwind breakpoint (768px) -- drives
 * `TackNotesPanel`'s `twoColumn` so the notes tab gets the same desktop
 * side-by-side / mobile stacked-with-back-button split every other panel
 * on this page already has via `hidden md:flex`. The package itself only
 * offers one fixed layout per mount, not a responsive one -- this is the
 * host-side equivalent. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResearchPage({ objectId, noteId, isNew }: Props) {
  const { user, token, isLoading } = useAuth();
  const { activeTeam, userRole, collectionMembers, isLoading: collectionLoading } = useCollection();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("notes");
  const isDesktop = useIsDesktop();

  const [allObjects, setAllObjects] = useState<CollectionObject[]>([]);
  const [contextObject, setContextObject] = useState<CollectionObject | null>(null);

  const [rightPanel, setRightPanel] = useState<RightPanel>("notes");
  const [exploreSource, setExploreSource] = useState<ExploreSource>("getty");
  const [exploreMenuOpen, setExploreMenuOpen] = useState(false);
  const exploreMenuRef = useRef<HTMLDivElement>(null);
  const [aiNoteContext, setAiNoteContext] = useState<{ title: string; body: string } | null>(null);

  // Read once by onBeforeSave when the composer's Save button is clicked --
  // see NoteExtraFields' own doc comment on why this can't just be React
  // state living in this component (renderComposerExtra/onBeforeSave are
  // two separate callbacks with no shared render pass between them).
  const draftRef = useRef<NoteExtraDraft>(EMPTY_DRAFT);
  // One-shot seed for a "save as note" hand-off from AI/Wikipedia/Explore --
  // see NoteExtraFields' own doc comment on pendingSeedRef.
  const pendingSeedRef = useRef<NoteExtraDraft | null>(null);

  // initialDraft is TackNotesPanel's own "open the create form pre-filled"
  // trigger -- a real state (not read straight from the isNew/objectId
  // props) so re-navigating to a fresh ?new=1 while this component stays
  // mounted (no full remount) still fires it again, and so
  // handleSaveAsNote can trigger the same thing from a sibling panel.
  const [initialDraft, setInitialDraft] = useState<{ title?: string; body_markdown: string } | null>(null);
  useEffect(() => {
    if (isNew) setInitialDraft({ body_markdown: "" });
  }, [isNew, objectId]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  // Objects are loaded once for the object-link picker and for resolving a
  // note's linked-object titles -- unrelated to TackNotesPanel itself,
  // which knows nothing about cartlann objects at all.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listObjects(token, { limit: 500 })
      .then((objectsData) => {
        if (cancelled) return;
        setAllObjects(objectsData);
        const resolvedObjectId =
          objectId ??
          (() => {
            try {
              const stored = localStorage.getItem("cartlann_last_object");
              return stored ? (JSON.parse(stored) as { id: string }).id : undefined;
            } catch {
              return undefined;
            }
          })();
        if (resolvedObjectId) {
          setContextObject(objectsData.find((o) => o.id === resolvedObjectId) ?? null);
        }
      })
      .catch(() => {
        /* Non-fatal: the object-link picker just won't offer choices. */
      });
    return () => {
      cancelled = true;
    };
  }, [token, objectId]);

  // Close explore menu on outside click
  useEffect(() => {
    if (!exploreMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (exploreMenuRef.current && !exploreMenuRef.current.contains(e.target as Node)) {
        setExploreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exploreMenuOpen]);

  if (isLoading || !user || !token || collectionLoading) return null;

  if (!activeTeam) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-8 text-center">
        <p className="text-sm text-slate-500">Select or create a collection to start researching.</p>
      </div>
    );
  }

  const api = createCartlannTackNotesApi(token, activeTeam.id, user.id);

  function resolveAuthor(userId: string): string {
    if (userId === user!.id) return t("you");
    const member = collectionMembers.find((m) => m.user_id === userId);
    return member?.display_name || t("unknown");
  }

  function handleSaveAsNote(title: string, description: string, body: string) {
    pendingSeedRef.current = { description: description || null, object_ids: contextObject ? [contextObject.id] : [] };
    setInitialDraft({ title, body_markdown: body });
    setRightPanel("notes");
  }

  function handleDigDeeper(note: Note) {
    if (!note.body_markdown) return;
    setAiNoteContext({ title: note.title, body: note.body_markdown });
    setRightPanel("ai");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Current object bar ─────────────────────────────────────────────────── */}
      <div className={`shrink-0 border-b flex items-center gap-3 px-4 py-2 ${contextObject ? "bg-teal-50 border-teal-200" : "bg-slate-50 border-slate-200"}`}>
        {contextObject ? (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <svg className="w-4 h-4 text-teal-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <span className="text-xs text-teal-600 font-medium">Researching:</span>
              <Link
                href={`/objects/${contextObject.id}`}
                className="text-sm font-semibold text-teal-800 hover:text-teal-900 hover:underline truncate"
              >
                {contextObject.title}
              </Link>
              {contextObject.accession_number && (
                <span className="text-xs text-teal-500 font-mono shrink-0">{contextObject.accession_number}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setContextObject(null)}
              className="text-xs text-teal-400 hover:text-teal-600 transition-colors shrink-0"
              title="Clear current object"
            >
              ✕
            </button>
          </>
        ) : (
          <span className="text-xs text-slate-400">No object selected — navigate to an object and click Research to set context.</span>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-slate-200 px-2 md:px-4 gap-0 shrink-0">
        {(
          [
            { id: "notes", label: "Notes" },
            { id: "ai", label: "AI" },
            { id: "wikipedia", label: "Wikipedia" },
          ] as { id: RightPanel; label: string }[]
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setRightPanel(id)}
            className={`px-2 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              rightPanel === id
                ? "border-teal-600 text-teal-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {label}
          </button>
        ))}

        {/* Explore dropdown */}
        <div ref={exploreMenuRef} className="relative flex items-center">
          <button
            type="button"
            onClick={() => setExploreMenuOpen((o) => !o)}
            className={`inline-flex items-center gap-1 px-2 md:px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              rightPanel === "explore"
                ? "border-teal-600 text-teal-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Explore
            <svg className={`w-3 h-3 transition-transform ${exploreMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {exploreMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 overflow-hidden">
              {([
                { id: "getty" as ExploreSource, icon: "https://www.getty.edu/favicon.ico", label: "Getty AAT", sub: "Art & Architecture Thesaurus" },
                { id: "europeana" as ExploreSource, icon: "https://www.europeana.eu/favicon.ico", label: "Europeana", sub: "European cultural heritage" },
                { id: "wikidata" as ExploreSource, icon: "https://www.wikidata.org/static/favicon/wikidata.ico", label: "Wikidata", sub: "Entities & authority records" },
                { id: "pas" as ExploreSource, icon: "https://finds.org.uk/favicon.ico", label: "British Museum PAS", sub: "Portable Antiquities Scheme" },
              ]).map(({ id, icon, label, sub }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setExploreSource(id); setRightPanel("explore"); setExploreMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    rightPanel === "explore" && exploreSource === id
                      ? "bg-teal-50 text-teal-800 font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon} alt="" className="w-4 h-4 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <div className="min-w-0 text-left">
                    <p className="leading-tight">{label}</p>
                    <p className="text-xs text-slate-400 font-normal leading-tight">{sub}</p>
                  </div>
                  {rightPanel === "explore" && exploreSource === id && <span className="ml-auto text-teal-600 text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {rightPanel === "notes" && (
          <TackNotesPanel
            api={api}
            owningService="cartlann"
            entityType="team"
            entityId={activeTeam.id}
            teamId={activeTeam.id}
            currentUserId={user.id}
            isAdmin={userRole === "admin"}
            resolveAuthor={resolveAuthor}
            t={t}
            listMode="team"
            folderScope="team"
            filterChips={NOTE_FILTER_CHIPS(t)}
            twoColumn={isDesktop}
            initialDraft={initialDraft}
            onInitialDraftConsumed={() => setInitialDraft(null)}
            initialSelectedNoteId={noteId}
            renderDetailBadges={(note) => renderCartlannDetailBadges(note, locale)}
            renderDetailHeaderActions={(note) =>
              note.body_markdown ? (
                <button
                  type="button"
                  onClick={() => handleDigDeeper(note)}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--tnotes-700,#be123c)] hover:bg-[var(--tnotes-50,#fff1f2)] border border-[var(--tnotes-200,#fecdd3)] hover:border-[var(--tnotes-300,#fda4af)] px-2 py-1 rounded-lg transition-colors mr-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Dig Deeper
                </button>
              ) : null
            }
            deleteWarning={cartlannDeleteWarning}
            renderComposerExtra={(mode, note) => (
              <NoteExtraFields
                key={`${mode}:${note?.id ?? "new"}`}
                mode={mode}
                note={note}
                allObjects={allObjects}
                contextObjectId={contextObject?.id ?? null}
                draftRef={draftRef}
                pendingSeedRef={pendingSeedRef}
              />
            )}
            onBeforeSave={async () => ({ ...draftRef.current })}
          />
        )}
        {rightPanel === "ai" && (
          <AiChat token={token} contextObject={contextObject} allObjects={allObjects} noteContext={aiNoteContext} onSaveAsNote={handleSaveAsNote} />
        )}
        {rightPanel === "wikipedia" && <WikipediaSearch onSaveAsNote={handleSaveAsNote} initialQuery={contextObject?.title} />}
        {rightPanel === "explore" && <ExplorePanel source={exploreSource} onSaveAsNote={handleSaveAsNote} contextObject={contextObject} />}
      </div>
    </div>
  );
}
