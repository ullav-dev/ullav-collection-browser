// Adapts cartlann's own `/research-notes` REST API (ullav-collection-server,
// see collection-api.ts) to the `TackNotesApi` interface
// `@ullav-dev/tack-notes`'s components expect, so `TackNotesPanel` can be
// used here exactly as it is in every other app in this migration, with no
// wire-format changes needed on cartlann's backend.
//
// This is a *hybrid* adapter, not a plain `createTackNotesApi` pointed at
// cartlann's own base URL, because cartlann's backend proxy does real work
// no direct tack-server call can replicate on its own:
// - object links (content_attachments, mirrored locally for read speed)
// - collection scoping (many collections share one team; tack itself has
//   no "collection" concept, only teams)
// - canvas/IIIF annotation merging (a different content shape entirely,
//   with no tack equivalent -- see handlers::research_notes's own doc
//   comment on the Rust side)
// - a description field and per-note object links, neither of which
//   tack-server's own Note schema has at all -- carried through the
//   generic extra/CartlannNote escape hatches @ullav-dev/tack-notes@26.2.2
//   added specifically for this (see that package's own README).
//
// So note/folder/reply CRUD and entity-attached listing route through
// cartlann's own endpoints (translating shapes both ways). Features that
// are purely tack-native with no cartlann-specific meaning at all --
// version history, unread tracking, system principals -- delegate straight
// to a real `createTackNotesApi` bound to the same-origin `/api/tack/*`
// proxy (see proxy.ts), using the same UUM JWT tack-server already accepts
// directly from every other app.
//
// Pagination/folder-filtering: cartlann's own `listNotes`/`listFolders`
// return everything unfiltered (same as the hand-rolled ResearchPage.tsx
// this replaces did -- not a new limitation), so `listNotes`/
// `listNoteFolders` below filter and paginate client-side.
//
// Per-user scoping: a *real* folder or "unfiled" is a personal organizing
// tool in cartlann's model, not a team-shared one -- ResearchPage.tsx's own
// `filterNotes` always scoped those two views to `n.user_id === userId`
// (only "All Notes" and the shared-by-* virtual folders ever crossed users).
// `listNotes`/`listNoteFolders` below reproduce that scoping exactly; it's
// not something `@ullav-dev/tack-notes` itself has any opinion on (real
// tack folders are genuinely team-shared), so it lives entirely here.

import {
  createNote as apiCreateNote,
  createFolder as apiCreateFolder,
  createNoteReply as apiCreateNoteReply,
  deleteFolder as apiDeleteFolder,
  deleteNote as apiDeleteNote,
  getNote as apiGetNote,
  listFolders as apiListFolders,
  listNoteReplies as apiListNoteReplies,
  listNotes as apiListNotes,
  listObjectNotes as apiListObjectNotes,
  renameFolder as apiRenameFolder,
  setNoteObjects as apiSetNoteObjects,
  updateNote as apiUpdateNote,
  type ResearchFolder,
  type ResearchNote,
} from "@/lib/collection-api";
import {
  createTackNotesApi,
  type Note,
  type NoteFolder,
  type NoteFoldersPage,
  type NotesPage,
  type TackNotesApi,
  type Visibility,
} from "@ullav-dev/tack-notes";

/** `Note`, widened with the cartlann-specific fields `@ullav-dev/tack-notes`
 * itself has no concept of. Every note this adapter returns is actually one
 * of these -- host components (`renderDetailBadges`, `renderComposerExtra`,
 * etc.) can safely cast a `Note` they're handed back to this shape, same
 * pattern as the package's own README describes for `extra`. */
export interface CartlannNote extends Note {
  description: string | null;
  object_ids: string[];
  /** Set only for a locally-stored canvas/IIIF annotation row merged into
   * the same list server-side -- see handlers::research_notes's own doc
   * comment on the Rust side. */
  canvas_id: string | null;
  is_shared: boolean;
}

/** The reserved `listNotes`/`filterChips` keys this adapter understands,
 * beyond the folderId/unfiled ones `@ullav-dev/tack-notes` already handles
 * itself. Mirrors `ResearchPage.tsx`'s old `VirtualFolder` type exactly. */
export type CartlannFilterKey = "shared-by-me" | "shared-by-others";

function toNote(rn: ResearchNote): CartlannNote {
  return {
    id: rn.id,
    organization_id: "", // unused by any tack-notes component; cartlann's own API doesn't expose it
    team_id: null,
    parent_id: rn.parent_id,
    folder_id: rn.folder_id,
    visibility: rn.visibility ?? (rn.is_shared ? "team" : "private"),
    title: rn.title,
    body_markdown: rn.body ?? "",
    created_by: rn.user_id,
    created_at: rn.created_at,
    updated_at: rn.updated_at,
    reply_count: rn.reply_count,
    in_reply_to_version: null,
    description: rn.description,
    object_ids: rn.object_ids,
    canvas_id: rn.canvas_id,
    is_shared: rn.is_shared,
  };
}

function toNoteFolder(rf: ResearchFolder, teamId: string, noteCount: number): NoteFolder {
  return {
    id: rf.id,
    organization_id: "",
    team_id: teamId,
    name: rf.name,
    owning_service: null,
    entity_type: null,
    entity_id: null,
    created_at: rf.created_at,
    updated_at: rf.created_at,
    note_count: noteCount,
  };
}

function paginate<T>(items: T[], limit?: number, offset?: number): { items: T[]; total: number; has_more: boolean } {
  const total = items.length;
  const o = offset ?? 0;
  const l = limit ?? 25;
  const page = items.slice(o, o + l);
  return { items: page, total, has_more: o + page.length < total };
}

/** `token`/`teamId`/`currentUserId` are captured at creation time, matching
 *  `createTackNotesApi`'s own shape -- callers rebuild this per token/team/
 *  user change (e.g. in a `useMemo`), same as every other app's NotesPanel
 *  wrapper does for its own API client. */
export function createCartlannTackNotesApi(token: string, teamId: string, currentUserId: string): TackNotesApi {
  // Pure-tack features cartlann's backend has no reason to wrap -- see this
  // file's own doc comment.
  const direct = createTackNotesApi("/api/tack", token);

  return {
    async listNotes(_teamId, opts) {
      const all = await apiListNotes(token);
      let filtered: ResearchNote[];
      if (opts?.filterKey === ("shared-by-me" satisfies CartlannFilterKey)) {
        filtered = all.filter((n) => n.is_shared && n.user_id === currentUserId);
      } else if (opts?.filterKey === ("shared-by-others" satisfies CartlannFilterKey)) {
        filtered = all.filter((n) => n.is_shared && n.user_id !== currentUserId);
      } else if (opts?.unfiled) {
        filtered = all.filter((n) => n.folder_id === null && n.user_id === currentUserId);
      } else if (opts?.folderId) {
        filtered = all.filter((n) => n.folder_id === opts.folderId && n.user_id === currentUserId);
      } else {
        // "all" (or no filter at all) -- every note, matching
        // ResearchPage.tsx's old `case "all": return notes;`.
        filtered = all;
      }
      const { items, total, has_more } = paginate(filtered, opts?.limit, opts?.offset);
      const page: NotesPage = { notes: items.map(toNote), total, has_more };
      return page;
    },

    async getNote(id) {
      return toNote(await apiGetNote(token, id));
    },

    async createNote(payload) {
      const extra = payload.extra as { description?: string | null; object_ids?: string[] } | undefined;
      const created = await apiCreateNote(token, {
        title: payload.title,
        description: extra?.description ?? null,
        body: payload.body_markdown,
        folder_id: payload.folder_id ?? null,
        visibility: payload.visibility,
        object_ids: extra?.object_ids ?? [],
      });
      return toNote(created);
    },

    async listNotesByAttachment(owningService, entityType, entityId) {
      if (owningService !== "cartlann" || entityType !== "object") return [];
      const notes = await apiListObjectNotes(token, entityId);
      return notes.map(toNote);
    },

    async updateNote(id, payload) {
      const extra = payload.extra as { description?: string | null; object_ids?: string[] } | undefined;
      let updated = await apiUpdateNote(token, id, {
        title: payload.title,
        body: payload.body_markdown,
        visibility: payload.visibility,
        folder_id: payload.folder_id,
        ...(extra && "description" in extra ? { description: extra.description } : {}),
      });
      if (extra?.object_ids !== undefined) {
        await apiSetNoteObjects(token, id, extra.object_ids);
        updated = { ...updated, object_ids: extra.object_ids };
      }
      return toNote(updated);
    },

    async deleteNote(id) {
      await apiDeleteNote(token, id);
    },

    async listReplies(id) {
      const replies = await apiListNoteReplies(token, id);
      return replies.map(toNote);
    },

    async createReply(id, bodyMarkdown) {
      const reply = await apiCreateNoteReply(token, id, bodyMarkdown);
      return toNote(reply);
    },

    async listNoteFolders(_teamId, opts) {
      const [folders, notes] = await Promise.all([apiListFolders(token), apiListNotes(token)]);
      const counts = new Map<string, number>();
      for (const n of notes) {
        // Real folders are a personal organizing tool here (see this
        // file's own doc comment) -- a folder's count/contents are always
        // scoped to its own owner, same as `listNotes` above.
        if (n.folder_id && n.user_id === currentUserId) counts.set(n.folder_id, (counts.get(n.folder_id) ?? 0) + 1);
      }
      const { items, total } = paginate(folders, opts?.limit, opts?.offset);
      const page: NoteFoldersPage = {
        folders: items.map((f) => toNoteFolder(f, teamId, counts.get(f.id) ?? 0)),
        total,
      };
      return page;
    },

    async createNoteFolder(payload) {
      const created = await apiCreateFolder(token, payload.name);
      return toNoteFolder(created, teamId, 0);
    },

    async renameNoteFolder(id, name) {
      const renamed = await apiRenameFolder(token, id, name);
      return toNoteFolder(renamed, teamId, 0);
    },

    async deleteNoteFolder(id) {
      await apiDeleteFolder(token, id);
    },

    async listNoteFoldersByAttachment() {
      // cartlann has no entity-scoped folders (folderScope="team" only).
      return [];
    },

    listRevisions: (id) => direct.listRevisions(id),
    createRevision: (id) => direct.createRevision(id),
    deleteRevision: (noteId, revisionId) => direct.deleteRevision(noteId, revisionId),
    markNoteRead: (id) => direct.markNoteRead(id),
    listUnread: (noteIds) => direct.listUnread(noteIds),
    listSystemPrincipals: (organizationId, opts) => direct.listSystemPrincipals(organizationId, opts),
  };
}

export type { Note as TackNote, Visibility as TackVisibility };
