"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  listNotes, createNote, updateNote, deleteNote,
  setNoteFolder, setNoteObjects,
  listFolders, createFolder, renameFolder, deleteFolder,
  listObjects,
  type ResearchNote, type ResearchFolder, type CollectionObject,
} from "@/lib/collection-api";
import MarkdownEditor, { MarkdownBody } from "@/components/MarkdownEditor";
import NoteThread from "@/components/NoteThread";
import AiChat from "@/components/AiChat";
import WikipediaSearch from "@/components/WikipediaSearch";
import ExplorePanel, { type ExploreSource } from "@/components/ExplorePanel";

// ── Types ─────────────────────────────────────────────────────────────────────

type VirtualFolder = "all" | "unfiled" | "shared-by-me" | "shared-by-others";
type ActiveFolder = VirtualFolder | string; // string = real folder UUID
type RightPanel = "notes" | "ai" | "wikipedia" | "explore";

interface NoteForm {
  title: string;
  description: string;
  body: string;
  folderId: string | null;
  isShared: boolean;
  objectIds: string[];
}

const EMPTY_FORM: NoteForm = {
  title: "",
  description: "",
  body: "",
  folderId: null,
  isShared: false,
  objectIds: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function filterNotes(
  notes: ResearchNote[],
  folder: ActiveFolder,
  userId: string,
): ResearchNote[] {
  switch (folder) {
    case "all":
      return notes;
    case "unfiled":
      return notes.filter((n) => n.folder_id === null && n.user_id === userId);
    case "shared-by-me":
      return notes.filter((n) => n.is_shared && n.user_id === userId);
    case "shared-by-others":
      return notes.filter((n) => n.is_shared && n.user_id !== userId);
    default:
      return notes.filter((n) => n.folder_id === folder && n.user_id === userId);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  objectId?: string;
  noteId?: string;
  isNew?: boolean;
}

export default function ResearchPage({ objectId, noteId, isNew }: Props) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  // ── Data state ───────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [folders, setFoldersState] = useState<ResearchFolder[]>([]);
  const [allObjects, setAllObjects] = useState<CollectionObject[]>([]);
  const [contextObject, setContextObject] = useState<CollectionObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [mobileView, setMobileView] = useState<"list" | "panel">("list");
  const [activeFolder, setActiveFolder] = useState<ActiveFolder>("all");
  const [activeNote, setActiveNote] = useState<ResearchNote | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("notes");
  const [exploreSource, setExploreSource] = useState<ExploreSource>("getty");
  const [exploreMenuOpen, setExploreMenuOpen] = useState(false);
  const exploreMenuRef = useRef<HTMLDivElement>(null);
  const [aiNoteContext, setAiNoteContext] = useState<{ title: string; body: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<NoteForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Folder management
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");

  // Object search for linking
  const [objectSearch, setObjectSearch] = useState("");
  const [showObjectSearch, setShowObjectSearch] = useState(false);
  const objectSearchRef = useRef<HTMLDivElement>(null);

  // ── Load data ─────────────────────────────────────────────────────────────────

  const loadNotes = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listNotes(token);
      setNotes(data);
    } catch {
      // non-critical refresh failure — keep existing data
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !user) { router.replace("/login"); return; }
    if (!token) return;

    let cancelled = false;
    setLoading(true);

    async function init() {
      try {
        const [notesData, foldersData, objectsData] = await Promise.all([
          listNotes(token!),
          listFolders(token!),
          listObjects(token!, { limit: 500 }),
        ]);
        if (cancelled) return;
        setNotes(notesData);
        setFoldersState(foldersData);
        setAllObjects(objectsData);

        // Resolve context object: from URL param, or fall back to last visited object
        const resolvedObjectId = objectId ?? (() => {
          try {
            const stored = localStorage.getItem("cartlann_last_object");
            return stored ? (JSON.parse(stored) as { id: string }).id : undefined;
          } catch { return undefined; }
        })();
        if (resolvedObjectId) {
          const obj = objectsData.find((o) => o.id === resolvedObjectId) ?? null;
          setContextObject(obj);
        }

        // Handle URL params
        if (noteId) {
          const found = notesData.find((n) => n.id === noteId);
          if (found) { setActiveNote(found); setRightPanel("notes"); }
        } else if (isNew) {
          setEditing(true);
          setForm({
            ...EMPTY_FORM,
            objectIds: objectId ? [objectId] : [],
          });
          setRightPanel("notes");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load research data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [isLoading, user, token, objectId, noteId, isNew, router]);

  // Auto-refresh shared-by-others every 60 seconds
  useEffect(() => {
    if (activeFolder !== "shared-by-others" || !token) return;
    const id = setInterval(loadNotes, 60000);
    return () => clearInterval(id);
  }, [activeFolder, loadNotes, token]);

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

  // Close object search on outside click
  useEffect(() => {
    if (!showObjectSearch) return;
    function handleClick(e: MouseEvent) {
      if (objectSearchRef.current && !objectSearchRef.current.contains(e.target as Node)) {
        setShowObjectSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showObjectSearch]);

  if (isLoading || !user || !token) return null;

  // token is non-null beyond this point — narrowed for handler closures
  const tok = token;
  const userId = user.id;
  const visibleNotes = filterNotes(notes, activeFolder, userId);

  // ── Note actions ──────────────────────────────────────────────────────────────

  function startCreate() {
    setEditing(true);
    setActiveNote(null);
    setRightPanel("notes");
    setMobileView("panel");
    setForm({
      ...EMPTY_FORM,
      folderId: typeof activeFolder === "string" && !["all", "unfiled", "shared-by-me", "shared-by-others"].includes(activeFolder)
        ? activeFolder : null,
      // Always pre-link to the current object — the user can remove the link if needed
      objectIds: contextObject ? [contextObject.id] : [],
    });
    setSaveError(null);
  }

  function handleSaveAsNote(title: string, description: string, body: string) {
    setRightPanel("notes");
    setEditing(true);
    setActiveNote(null);
    setForm({
      title,
      description,
      body,
      folderId: null,
      isShared: false,
      objectIds: contextObject ? [contextObject.id] : [],
    });
    setSaveError(null);
  }

  function handleDigDeeper(note: ResearchNote) {
    setAiNoteContext(note.body ? { title: note.title, body: note.body } : null);
    setRightPanel("ai");
    setMobileView("panel");
  }

  function startEdit(note: ResearchNote) {
    setEditing(true);
    setForm({
      title: note.title,
      description: note.description ?? "",
      body: note.body ?? "",
      folderId: note.folder_id,
      isShared: note.is_shared,
      objectIds: note.object_ids,
    });
    setSaveError(null);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
    setConfirmDelete(false);
  }

  async function saveNote() {
    if (!form.title.trim()) { setSaveError("Title is required"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      let saved: ResearchNote;
      if (activeNote && !editing) return; // shouldn't happen
      if (activeNote) {
        saved = await updateNote(tok, activeNote.id, {
          title: form.title,
          description: form.description || null,
          body: form.body || null,
          folder_id: form.folderId,
          is_shared: form.isShared,
        });
        // Sync object links if changed
        const prevIds = [...activeNote.object_ids].sort().join(",");
        const nextIds = [...form.objectIds].sort().join(",");
        if (prevIds !== nextIds) {
          await setNoteObjects(tok, saved.id, form.objectIds);
          saved = { ...saved, object_ids: form.objectIds };
        }
      } else {
        saved = await createNote(tok, {
          title: form.title,
          description: form.description || null,
          body: form.body || null,
          folder_id: form.folderId,
          is_shared: form.isShared,
          object_ids: form.objectIds,
        });
      }
      await loadNotes();
      setActiveNote(saved);
      setEditing(false);
      setConfirmDelete(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeNote) return;
    setSaving(true);
    try {
      await deleteNote(tok, activeNote.id);
      await loadNotes();
      setActiveNote(null);
      setEditing(false);
      setConfirmDelete(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to delete note");
    } finally {
      setSaving(false);
    }
  }

  // ── Folder actions ────────────────────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      const f = await createFolder(tok, newFolderName.trim());
      setFoldersState((prev) => [...prev, f]);
      setNewFolderMode(false);
      setNewFolderName("");
      setActiveFolder(f.id);
    } catch { /* ignore */ }
  }

  async function handleRenameFolder(id: string) {
    if (!renamingName.trim()) return;
    try {
      const f = await renameFolder(tok, id, renamingName.trim());
      setFoldersState((prev) => prev.map((x) => (x.id === id ? f : x)));
      setRenamingFolder(null);
    } catch { /* ignore */ }
  }

  async function handleDeleteFolder(id: string) {
    try {
      await deleteFolder(tok, id);
      setFoldersState((prev) => prev.filter((f) => f.id !== id));
      if (activeFolder === id) setActiveFolder("all");
    } catch { /* ignore */ }
  }

  async function handleSetFolder(folderId: string | null) {
    if (!activeNote) return;
    await setNoteFolder(tok, activeNote.id, folderId);
    setForm((f) => ({ ...f, folderId }));
    await loadNotes();
  }

  // ── Object link helpers ───────────────────────────────────────────────────────

  function objectById(id: string): CollectionObject | undefined {
    return allObjects.find((o) => o.id === id);
  }

  function addObject(obj: CollectionObject) {
    if (form.objectIds.includes(obj.id)) return;
    setForm((f) => ({ ...f, objectIds: [...f.objectIds, obj.id] }));
  }

  function removeObject(id: string) {
    setForm((f) => ({ ...f, objectIds: f.objectIds.filter((x) => x !== id) }));
  }

  const objectSearchResults = objectSearch.trim().length >= 2
    ? allObjects
        .filter((o) =>
          o.title.toLowerCase().includes(objectSearch.toLowerCase()) ||
          (o.accession_number ?? "").toLowerCase().includes(objectSearch.toLowerCase())
        )
        .filter((o) => !form.objectIds.includes(o.id))
        .slice(0, 8)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────────

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

    <div className="flex flex-1 overflow-hidden">
      {/* ── Folder sidebar — hidden on mobile, shown md+ ───────────────────────── */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-slate-200 bg-white flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-slate-100">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Research</h2>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {/* Context object breadcrumb */}
          {contextObject && (
            <div className="px-3 pb-2 mb-1 border-b border-slate-100">
              <Link
                href={`/objects/${contextObject.id}`}
                className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="truncate">{contextObject.title}</span>
              </Link>
            </div>
          )}

          {/* Virtual folders */}
          {(
            [
              { id: "all", label: "All Notes" },
              { id: "unfiled", label: "Unfiled" },
              { id: "shared-by-me", label: "Shared by Me" },
              { id: "shared-by-others", label: "Shared by Others" },
            ] as { id: ActiveFolder; label: string }[]
          ).map(({ id, label }) => (
            <FolderItem
              key={id}
              label={label}
              active={activeFolder === id}
              onClick={() => setActiveFolder(id)}
              count={filterNotes(notes, id, userId).length}
            />
          ))}

          {/* Real folders */}
          {folders.length > 0 && (
            <div className="mt-1 mb-1 px-3">
              <div className="border-t border-slate-100" />
            </div>
          )}
          {folders.map((f) =>
            renamingFolder === f.id ? (
              <div key={f.id} className="flex items-center gap-1 px-2 py-1">
                <input
                  autoFocus
                  value={renamingName}
                  onChange={(e) => setRenamingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameFolder(f.id);
                    if (e.key === "Escape") setRenamingFolder(null);
                  }}
                  className="flex-1 text-xs rounded border border-teal-400 px-2 py-1 focus:outline-none"
                />
              </div>
            ) : (
              <FolderItemReal
                key={f.id}
                folder={f}
                active={activeFolder === f.id}
                onClick={() => setActiveFolder(f.id)}
                count={filterNotes(notes, f.id, userId).length}
                onRename={() => { setRenamingFolder(f.id); setRenamingName(f.name); }}
                onDelete={() => handleDeleteFolder(f.id)}
              />
            )
          )}

          {/* New folder */}
          {newFolderMode ? (
            <div className="flex items-center gap-1 px-2 py-1">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setNewFolderMode(false); setNewFolderName(""); }
                }}
                className="flex-1 text-xs rounded border border-teal-400 px-2 py-1 focus:outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNewFolderMode(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-teal-600 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Folder
            </button>
          )}
        </nav>
      </aside>

      {/* ── Notes list — full-width on mobile, fixed on md+ ────────────────────── */}
      <section className={`${mobileView === "panel" ? "hidden" : "flex"} md:flex w-full md:w-64 shrink-0 border-r border-slate-200 bg-slate-50 flex-col overflow-hidden`}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 bg-white">
          <span className="text-xs font-semibold text-slate-600">
            {visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}
          </span>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New
          </button>
        </div>

        {/* Mobile folder chip strip — visible on < md only */}
        <div className="md:hidden flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-slate-100 bg-white shrink-0">
          {(["all", "unfiled", "shared-by-me", "shared-by-others"] as ActiveFolder[]).map((id) => {
            const labels: Record<string, string> = {
              all: "All", unfiled: "Unfiled",
              "shared-by-me": "Mine", "shared-by-others": "Others",
            };
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveFolder(id)}
                className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                  activeFolder === id
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {labels[id as string]}
              </button>
            );
          })}
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFolder(f.id)}
              className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                activeFolder === f.id
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading…</div>
          ) : visibleNotes.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-xs text-slate-400">No notes here.</p>
              <button
                type="button"
                onClick={startCreate}
                className="mt-2 text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                Create one →
              </button>
            </div>
          ) : (
            visibleNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                active={activeNote?.id === note.id}
                currentUserId={userId}
                onClick={() => {
                  setActiveNote(note);
                  setEditing(false);
                  setRightPanel("notes");
                  setConfirmDelete(false);
                  setMobileView("panel");
                }}
              />
            ))
          )}
        </div>
      </section>

      {/* ── Right panel — hidden on mobile when list view is active ───────────── */}
      <div className={`${mobileView === "list" ? "hidden" : "flex"} md:flex flex-1 flex-col min-w-0 bg-white overflow-hidden`}>
        {/* Tab bar + mobile back button */}
        <div className="flex items-center border-b border-slate-200 px-2 md:px-4 gap-0 shrink-0">
          {/* Back to notes list — mobile only */}
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className="md:hidden mr-1 p-2 text-slate-400 hover:text-teal-600 transition-colors shrink-0"
            aria-label="Back to notes"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

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
              onClick={() => { setRightPanel(id); setMobileView("panel"); }}
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
              onClick={() => { setExploreMenuOpen((o) => !o); setMobileView("panel"); }}
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
                  { id: "getty" as ExploreSource,    icon: "https://www.getty.edu/favicon.ico",                                              label: "Getty AAT",   sub: "Art & Architecture Thesaurus" },
                  { id: "europeana" as ExploreSource, icon: "https://www.europeana.eu/favicon.ico",                                           label: "Europeana",   sub: "European cultural heritage" },
                  { id: "wikidata" as ExploreSource,  icon: "https://www.wikidata.org/static/favicon/wikidata.ico",                           label: "Wikidata",    sub: "Entities & authority records" },
                  { id: "pas" as ExploreSource,       icon: "https://finds.org.uk/favicon.ico",                                              label: "British Museum PAS", sub: "Portable Antiquities Scheme" },
                ]).map(({ id, icon, label, sub }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setExploreSource(id); setRightPanel("explore"); setExploreMenuOpen(false); setMobileView("panel"); }}
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
                    {rightPanel === "explore" && exploreSource === id && (
                      <span className="ml-auto text-teal-600 text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto">
          {rightPanel === "notes" && token && (
            <NotesPanel
              note={activeNote}
              editing={editing}
              form={form}
              setForm={setForm}
              saving={saving}
              saveError={saveError}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              token={token}
              userId={userId}
              locale={locale}
              folders={folders}
              allObjects={allObjects}
              objectById={objectById}
              objectSearch={objectSearch}
              setObjectSearch={setObjectSearch}
              showObjectSearch={showObjectSearch}
              setShowObjectSearch={setShowObjectSearch}
              objectSearchRef={objectSearchRef}
              objectSearchResults={objectSearchResults}
              onStartCreate={startCreate}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSave={saveNote}
              onDelete={handleDelete}
              onSetFolder={handleSetFolder}
              onAddObject={addObject}
              onRemoveObject={removeObject}
              onDigDeeper={handleDigDeeper}
            />
          )}
          {rightPanel === "ai" && (
            <AiChat
              token={tok}
              contextObject={contextObject}
              allObjects={allObjects}
              noteContext={aiNoteContext}
              onSaveAsNote={handleSaveAsNote}
            />
          )}
          {rightPanel === "wikipedia" && (
            <WikipediaSearch
              onSaveAsNote={handleSaveAsNote}
              initialQuery={contextObject?.title}
            />
          )}
          {rightPanel === "explore" && (
            <ExplorePanel
              source={exploreSource}
              onSaveAsNote={handleSaveAsNote}
              contextObject={contextObject}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-3 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
    </div>
    </div>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────

interface NotesPanelProps {
  note: ResearchNote | null;
  editing: boolean;
  form: NoteForm;
  setForm: React.Dispatch<React.SetStateAction<NoteForm>>;
  saving: boolean;
  saveError: string | null;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  token: string;
  userId: string;
  locale: string;
  folders: ResearchFolder[];
  allObjects: CollectionObject[];
  objectById: (id: string) => CollectionObject | undefined;
  objectSearch: string;
  setObjectSearch: (v: string) => void;
  showObjectSearch: boolean;
  setShowObjectSearch: (v: boolean) => void;
  objectSearchRef: React.RefObject<HTMLDivElement | null>;
  objectSearchResults: CollectionObject[];
  onStartCreate: () => void;
  onStartEdit: (note: ResearchNote) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onSetFolder: (folderId: string | null) => void;
  onAddObject: (obj: CollectionObject) => void;
  onRemoveObject: (id: string) => void;
  onDigDeeper: (note: ResearchNote) => void;
}

function NotesPanel({
  note, editing, form, setForm, saving, saveError, confirmDelete, setConfirmDelete,
  token, userId, locale, folders, allObjects, objectById,
  objectSearch, setObjectSearch, showObjectSearch, setShowObjectSearch,
  objectSearchRef, objectSearchResults,
  onStartCreate, onStartEdit, onCancelEdit, onSave, onDelete, onSetFolder,
  onAddObject, onRemoveObject, onDigDeeper,
}: NotesPanelProps) {
  // ── Editing / creating ───────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-700">
            {note ? "Edit Note" : "New Note"}
          </h2>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Note title…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief subtitle or abstract…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
            <MarkdownEditor
              value={form.body}
              onChange={(v) => setForm((f) => ({ ...f, body: v }))}
              placeholder="Write your research notes in Markdown…"
              minRows={14}
            />
          </div>

          {/* Folder + sharing row */}
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="block text-sm font-medium text-slate-700 mb-1">Folder</label>
              <select
                value={form.folderId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, folderId: e.target.value || null }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-7">
              <input
                id="is-shared"
                type="checkbox"
                checked={form.isShared}
                onChange={(e) => setForm((f) => ({ ...f, isShared: e.target.checked }))}
                className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
              />
              <label htmlFor="is-shared" className="text-sm text-slate-700 select-none">
                Share with institution
              </label>
            </div>
          </div>

          {/* Linked objects */}
          <ObjectLinkPanel
            objectIds={form.objectIds}
            objectById={objectById}
            objectSearch={objectSearch}
            setObjectSearch={setObjectSearch}
            showObjectSearch={showObjectSearch}
            setShowObjectSearch={setShowObjectSearch}
            objectSearchRef={objectSearchRef}
            objectSearchResults={objectSearchResults}
            onAdd={onAddObject}
            onRemove={onRemoveObject}
          />

          {/* Actions */}
          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !form.title.trim()}
                className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
            {note && (
              confirmDelete ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Delete this note?</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={saving}
                    className="text-red-600 hover:text-red-700 font-medium"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-red-400 hover:text-red-600 transition-colors"
                >
                  Delete note
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── No note selected ──────────────────────────────────────────────────────────
  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
        <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500 mb-4">Select a note or create a new one to get started.</p>
        <button
          type="button"
          onClick={onStartCreate}
          className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          + New Note
        </button>
      </div>
    );
  }

  // ── Note viewer ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {/* Note header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-800 leading-tight">{note.title}</h2>
          {note.description && (
            <p className="mt-1 text-sm text-slate-500">{note.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {note.body && (
            <button
              type="button"
              onClick={() => onDigDeeper(note)}
              className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Dig Deeper
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartEdit(note)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Edit
          </button>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-xs text-slate-400">Updated {relativeTime(note.updated_at)}</span>
        {note.is_shared && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Shared
          </span>
        )}
        {note.reply_count > 0 && (
          <span className="text-xs text-slate-400">{note.reply_count} {note.reply_count === 1 ? "reply" : "replies"}</span>
        )}
        {note.object_ids.length > 0 && (
          <span className="text-xs text-slate-400">{note.object_ids.length} linked {note.object_ids.length === 1 ? "object" : "objects"}</span>
        )}
      </div>

      {/* Linked objects (view) */}
      {note.object_ids.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {note.object_ids.map((oid) => {
            const obj = objectById(oid);
            return (
              <a
                key={oid}
                href={`/${locale}/objects/${oid}`}
                className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-200 rounded-full px-2.5 py-0.5 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                {obj ? obj.title : oid.slice(0, 8) + "…"}
              </a>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div className="mb-6">
        {note.body ? (
          <MarkdownBody content={note.body} />
        ) : (
          <p className="text-slate-400 italic text-sm">No content yet. Click Edit to add notes.</p>
        )}
      </div>

      {/* Thread (shared notes only) */}
      {note.is_shared && (
        <NoteThread note={note} token={token} currentUserId={userId} />
      )}
    </div>
  );
}

// ── Object link panel ─────────────────────────────────────────────────────────

interface ObjectLinkPanelProps {
  objectIds: string[];
  objectById: (id: string) => CollectionObject | undefined;
  objectSearch: string;
  setObjectSearch: (v: string) => void;
  showObjectSearch: boolean;
  setShowObjectSearch: (v: boolean) => void;
  objectSearchRef: React.RefObject<HTMLDivElement | null>;
  objectSearchResults: CollectionObject[];
  onAdd: (obj: CollectionObject) => void;
  onRemove: (id: string) => void;
}

function ObjectLinkPanel({
  objectIds, objectById, objectSearch, setObjectSearch,
  showObjectSearch, setShowObjectSearch, objectSearchRef,
  objectSearchResults, onAdd, onRemove,
}: ObjectLinkPanelProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">Linked Objects</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {objectIds.map((id) => {
          const obj = objectById(id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full pl-2.5 pr-1.5 py-0.5"
            >
              {obj ? obj.title : id.slice(0, 8) + "…"}
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="w-3.5 h-3.5 text-teal-400 hover:text-teal-700 transition-colors"
              >
                ×
              </button>
            </span>
          );
        })}

        {/* Add button */}
        <div className="relative" ref={objectSearchRef}>
          <button
            type="button"
            onClick={() => setShowObjectSearch(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 border border-dashed border-slate-300 hover:border-teal-400 rounded-full px-2.5 py-0.5 transition-colors"
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
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 mb-1"
              />
              {objectSearch.trim().length < 2 ? (
                <p className="text-xs text-slate-400 px-1 py-1">Type at least 2 characters</p>
              ) : objectSearchResults.length === 0 ? (
                <p className="text-xs text-slate-400 px-1 py-1">No matches</p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                  {objectSearchResults.map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => { onAdd(obj); setObjectSearch(""); setShowObjectSearch(false); }}
                      className="w-full text-left px-2 py-2 text-xs hover:bg-teal-50 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-slate-800 truncate">{obj.title}</div>
                      {obj.accession_number && (
                        <div className="text-slate-400 font-mono">{obj.accession_number}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar helpers ───────────────────────────────────────────────────────────

function FolderItem({
  label, active, onClick, count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-teal-50 text-teal-700 font-medium"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      <span className="truncate">{label}</span>
      {count > 0 && (
        <span className={`text-[11px] ${active ? "text-teal-500" : "text-slate-400"}`}>{count}</span>
      )}
    </button>
  );
}

function FolderItemReal({
  folder, active, onClick, count, onRename, onDelete,
}: {
  folder: ResearchFolder;
  active: boolean;
  onClick: () => void;
  count: number;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="relative group flex items-center">
      {/* Folder row — separated from the three-dot button to avoid button-in-button */}
      <button
        type="button"
        onClick={onClick}
        className={`flex-1 flex items-center justify-between px-3 py-1.5 text-sm transition-colors min-w-0 ${
          active
            ? "bg-teal-50 text-teal-700 font-medium"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <svg className="w-3 h-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="truncate">{folder.name}</span>
        </span>
        {count > 0 && (
          <span className={`text-[11px] shrink-0 ${active ? "text-teal-500" : "text-slate-400"}`}>{count}</span>
        )}
      </button>
      {/* Three-dot menu — sibling of the folder button, not inside it */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        className="w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 rounded transition-all shrink-0 mr-1"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {menuOpen && (
        <div ref={menuRef} className="absolute right-1 top-full mt-0.5 w-32 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-20">
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onRename(); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onDelete(); }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            Delete folder
          </button>
        </div>
      )}
    </div>
  );
}

// ── Note list item ────────────────────────────────────────────────────────────

function NoteListItem({
  note, active, currentUserId, onClick,
}: {
  note: ResearchNote;
  active: boolean;
  currentUserId: string;
  onClick: () => void;
}) {
  const excerpt = note.description ?? note.body?.slice(0, 80) ?? "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-3 transition-colors ${
        active ? "bg-teal-50" : "hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-0.5">
        <span className={`text-sm font-medium truncate ${active ? "text-teal-700" : "text-slate-800"}`}>
          {note.title}
        </span>
      </div>
      {excerpt && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-1">{excerpt}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-slate-400">{relativeTime(note.updated_at)}</span>
        {note.is_shared && (
          <span className="text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">Shared</span>
        )}
        {note.user_id !== currentUserId && (
          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Colleague</span>
        )}
        {note.reply_count > 0 && (
          <span className="text-[10px] text-slate-400">{note.reply_count} replies</span>
        )}
        {note.object_ids.length > 0 && (
          <span className="text-[10px] text-slate-400">{note.object_ids.length} objects</span>
        )}
      </div>
    </button>
  );
}

// ── Placeholder panel ─────────────────────────────────────────────────────────

function ComingSoonPanel({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-8 text-center">
      <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-sm text-slate-400">Coming in Phase {phase}</p>
    </div>
  );
}
