// Adapts cartlann's own `/research-notes` REST API (ullav-collection-server,
// see collection-api.ts) to the `TackNotesApi` interface
// `@ullav-dev/tack-notes`'s components expect, so `TackNoteTree`/
// `TackNotesPanel`/`TackNoteThread` can be used here exactly as they are in
// every other app in this migration, with no wire-format changes needed on
// cartlann's backend.
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

function toNote(rn: ResearchNote): Note {
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

/** `token` and `teamId` are captured at creation time, matching
 *  `createTackNotesApi`'s own shape -- callers rebuild this per token/team
 *  change (e.g. in a `useMemo`), same as every other app's NotesPanel
 *  wrapper does for its own API client. */
export function createCartlannTackNotesApi(token: string, teamId: string): TackNotesApi {
  // Pure-tack features cartlann's backend has no reason to wrap -- see this
  // file's own doc comment.
  const direct = createTackNotesApi("/api/tack", token);

  return {
    async listNotes(_teamId, opts) {
      const all = await apiListNotes(token);
      let filtered = all;
      if (opts?.unfiled) {
        filtered = filtered.filter((n) => n.folder_id === null);
      } else if (opts?.folderId) {
        filtered = filtered.filter((n) => n.folder_id === opts.folderId);
      }
      const { items, total, has_more } = paginate(filtered, opts?.limit, opts?.offset);
      const page: NotesPage = { notes: items.map(toNote), total, has_more };
      return page;
    },

    async getNote(id) {
      return toNote(await apiGetNote(token, id));
    },

    async createNote(payload) {
      const created = await apiCreateNote(token, {
        title: payload.title,
        body: payload.body_markdown,
        folder_id: payload.folder_id ?? null,
        visibility: payload.visibility,
      });
      return toNote(created);
    },

    async listNotesByAttachment(owningService, entityType, entityId) {
      if (owningService !== "cartlann" || entityType !== "object") return [];
      const notes = await apiListObjectNotes(token, entityId);
      return notes.map(toNote);
    },

    async updateNote(id, payload) {
      const updated = await apiUpdateNote(token, id, {
        title: payload.title,
        body: payload.body_markdown,
        visibility: payload.visibility,
        folder_id: payload.folder_id,
      });
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
        if (n.folder_id) counts.set(n.folder_id, (counts.get(n.folder_id) ?? 0) + 1);
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
