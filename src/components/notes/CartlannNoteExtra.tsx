"use client";

// Cartlann-specific extension-point content for @ullav-dev/tack-notes'
// TackNotesPanel/TackNoteThread -- everything here plugs into the generic
// renderComposerExtra/renderDetailBadges/renderDetailHeaderActions/
// deleteWarning escape hatches added in @ullav-dev/tack-notes@26.2.2
// specifically for this migration (see that package's own README). None of
// this is tack-notes' concern: object links, a description field, and IIIF
// canvas annotations are all purely cartlann concepts.

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Note } from "@ullav-dev/tack-notes";
import type { CollectionObject } from "@/lib/collection-api";
import type { CartlannNote } from "@/lib/tack-notes-adapter";

/** What `onBeforeSave` reads back out once the user hits Save -- kept in a
 * ref rather than component state one level up, since `renderComposerExtra`
 * and `onBeforeSave` are two separate callbacks with no shared render pass
 * between them. */
export interface NoteExtraDraft {
  description: string | null;
  object_ids: string[];
}

export const EMPTY_DRAFT: NoteExtraDraft = { description: null, object_ids: [] };

interface NoteExtraFieldsProps {
  mode: "create" | "edit";
  note: Note | undefined;
  allObjects: CollectionObject[];
  /** Pre-links a new note to the object currently being researched --
   * mirrors `ResearchPage.tsx`'s old `startCreate`/`handleSaveAsNote`
   * behavior ("always pre-link to the current object; the user can remove
   * the link if needed"). Ignored in edit mode -- an existing note's own
   * links always take precedence. */
  contextObjectId: string | null;
  draftRef: RefObject<NoteExtraDraft>;
  /** A one-shot seed for a brand-new create form, e.g. cartlann's "save
   * this AI/Wikipedia response as a note" hand-off (which has its own
   * description text and object link to carry over, distinct from the
   * ordinary "+ Add note" button's plain context-object prefill). Read
   * once at mount and cleared immediately after -- the same consume-once
   * contract `TackNotesPanel`'s own `initialDraft` has, reimplemented here
   * since object links/description are cartlann-only concepts `initialDraft`
   * itself has no field for. `null`/unset falls through to the ordinary
   * context-object-only prefill. */
  pendingSeedRef?: RefObject<NoteExtraDraft | null>;
}

/** Rendered inside both the create-note and edit-note composer forms (see
 * `renderComposerExtra`'s own doc comment on `TackNotesPanel`/
 * `TackNoteThread`) -- a description field plus the object-link editor,
 * extracted from `ResearchPage.tsx`'s old inline form fields and
 * `ObjectLinkPanel`. Give this a `key` that changes across mode/note
 * switches (`${mode}:${note?.id ?? "new"}`) so it remounts fresh instead of
 * carrying stale local state from a previously-open form. */
export default function NoteExtraFields({ mode, note, allObjects, contextObjectId, draftRef, pendingSeedRef }: NoteExtraFieldsProps) {
  const cn = note as CartlannNote | undefined;
  // Consumed once, synchronously, before first render -- a ref mutation is
  // visible immediately (unlike state), so this always sees whatever
  // handleSaveAsNote just wrote, and never a stale value from an earlier
  // save-as-note action once cleared.
  const seed = mode === "create" ? pendingSeedRef?.current ?? null : null;
  if (seed && pendingSeedRef) pendingSeedRef.current = null;

  const [description, setDescription] = useState(seed?.description ?? cn?.description ?? "");
  const [objectIds, setObjectIds] = useState<string[]>(
    seed?.object_ids ?? cn?.object_ids ?? (mode === "create" && contextObjectId ? [contextObjectId] : []),
  );
  const [objectSearch, setObjectSearch] = useState("");
  const [showObjectSearch, setShowObjectSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Keeps the shared ref in sync so onBeforeSave (invoked from a sibling
  // callback on submit, not from this component's own render) always reads
  // the latest draft.
  useEffect(() => {
    draftRef.current = { description: description.trim() || null, object_ids: objectIds };
  }, [description, objectIds, draftRef]);

  useEffect(() => {
    if (!showObjectSearch) return;
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowObjectSearch(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showObjectSearch]);

  const objectById = (id: string) => allObjects.find((o) => o.id === id);
  const searchResults =
    objectSearch.trim().length >= 2
      ? allObjects
          .filter(
            (o) =>
              o.title.toLowerCase().includes(objectSearch.toLowerCase()) ||
              (o.accession_number ?? "").toLowerCase().includes(objectSearch.toLowerCase()),
          )
          .filter((o) => !objectIds.includes(o.id))
          .slice(0, 8)
      : [];

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief subtitle or abstract…"
          className="box-border w-full text-sm rounded border border-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--tnotes-400,#fb7185)]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Linked objects</label>
        <div className="flex flex-wrap gap-1.5">
          {objectIds.map((id) => {
            const obj = objectById(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-xs bg-[var(--tnotes-50,#fff1f2)] text-[var(--tnotes-700,#be123c)] border border-[var(--tnotes-200,#fecdd3)] rounded-full pl-2.5 pr-1.5 py-0.5"
              >
                {obj ? obj.title : id.slice(0, 8) + "…"}
                <button
                  type="button"
                  onClick={() => setObjectIds((prev) => prev.filter((x) => x !== id))}
                  className="w-3.5 h-3.5 text-[var(--tnotes-400,#fb7185)] hover:text-[var(--tnotes-700,#be123c)] transition-colors"
                >
                  ×
                </button>
              </span>
            );
          })}

          <div className="relative" ref={searchRef}>
            <button
              type="button"
              onClick={() => setShowObjectSearch(true)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[var(--tnotes-700,#be123c)] border border-dashed border-slate-300 hover:border-[var(--tnotes-400,#fb7185)] rounded-full px-2.5 py-0.5 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Link object
            </button>

            {showObjectSearch && (
              <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-30 p-2">
                <input
                  autoFocus
                  value={objectSearch}
                  onChange={(e) => setObjectSearch(e.target.value)}
                  placeholder="Search objects…"
                  className="box-border w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 focus:border-[var(--tnotes-500,#f43f5e)] focus:outline-none focus:ring-1 focus:ring-[var(--tnotes-500,#f43f5e)] mb-1"
                />
                {objectSearch.trim().length < 2 ? (
                  <p className="text-xs text-slate-400 px-1 py-1">Type at least 2 characters</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-slate-400 px-1 py-1">No matches</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                    {searchResults.map((obj) => (
                      <button
                        key={obj.id}
                        type="button"
                        onClick={() => {
                          setObjectIds((prev) => [...prev, obj.id]);
                          setObjectSearch("");
                          setShowObjectSearch(false);
                        }}
                        className="w-full text-left px-2 py-2 text-xs hover:bg-[var(--tnotes-50,#fff1f2)] rounded-lg transition-colors"
                      >
                        <div className="font-medium text-slate-800 truncate">{obj.title}</div>
                        {obj.accession_number && <div className="text-slate-400 font-mono">{obj.accession_number}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail-view extension points ────────────────────────────────────────────

/** `renderDetailBadges` -- the IIIF badge + viewer link for a canvas
 * annotation, plus the note's own description (if any) forced onto its own
 * row via `basis-full` inside the badges' `flex flex-wrap` container
 * (`TackNoteThread` has no dedicated subtitle slot; a 100%-width flex
 * child is the standard way to force a wrap point inside one without
 * needing a package change for it). */
export function renderCartlannDetailBadges(note: Note, locale: string) {
  const cn = note as CartlannNote;
  return (
    <>
      {cn.canvas_id && cn.object_ids.length > 0 && (
        <a
          href={`/${locale}/objects/${cn.object_ids[0]}?tab=viewer`}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full transition-colors"
        >
          IIIF · View in viewer
        </a>
      )}
      {cn.description && <span className="basis-full text-xs text-slate-500 italic">{cn.description}</span>}
    </>
  );
}

/** `deleteWarning` -- the stronger, IIIF-aware copy `ResearchPage.tsx`'s old
 * delete-confirmation modal showed for a canvas-annotation note. `undefined`
 * (the default copy) for every other note. */
export function cartlannDeleteWarning(note: Note): string | undefined {
  const cn = note as CartlannNote;
  return cn.canvas_id
    ? "This note is linked to a IIIF canvas annotation. Deleting it will permanently remove both the research note and the annotation marker from the image viewer. This cannot be undone."
    : undefined;
}
