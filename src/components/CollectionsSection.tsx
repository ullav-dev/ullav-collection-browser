"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  listCollectionMembers,
  addCollectionMember,
  updateCollectionMemberRole,
  removeCollectionMember,
  type Collection,
  type CollectionMember,
} from "@/lib/collection-api";
import { getTeam, type Team } from "@/lib/auth-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";
const selectCls = inputCls;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Create collection modal ───────────────────────────────────────────────────

function CreateCollectionModal({
  teams,
  onClose,
  onCreated,
}: {
  teams: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { token } = useAuth();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(v: string) {
    setName(v);
    setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !teamId) return;
    setSaving(true);
    setError(null);
    try {
      await createCollection(token, { team_id: teamId, name, slug, description: description || undefined, is_public: isPublic });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">New collection</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Team</label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} className={selectCls} required>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input required value={name} onChange={e => handleNameChange(e.target.value)} className={inputCls} placeholder="Main Collection" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Slug</label>
            <input required value={slug} onChange={e => setSlug(e.target.value)} className={inputCls} placeholder="main-collection" pattern="[a-z0-9\-]+" />
            <p className="text-xs text-slate-400 mt-0.5">Lowercase letters, numbers, hyphens only</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} placeholder="Optional" />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
            <span className="text-sm text-slate-700">Public collection (browseable without login)</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 border border-slate-300 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving || !name || !slug || !teamId} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {saving ? "Creating…" : "Create collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit collection form ──────────────────────────────────────────────────────

const NIL_TEAM_ID = "00000000-0000-0000-0000-000000000000";

function EditCollectionForm({
  collection,
  adminTeams,
  onSave,
  onCancel,
}: {
  collection: Collection;
  adminTeams: { id: string; name: string }[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const { token } = useAuth();
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const [isPublic, setIsPublic] = useState(collection.is_public);
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unassigned = collection.team_id === NIL_TEAM_ID;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateCollection(token, collection.id, {
        name,
        description: description || undefined,
        is_public: isPublic,
        team_id: teamId || undefined,
      });
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
        <input required value={name} onChange={e => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
      </div>
      {unassigned && adminTeams.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Assign team</label>
          <select value={teamId} onChange={e => setTeamId(e.target.value)} className={selectCls}>
            <option value="">— Leave unassigned —</option>
            {adminTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
        <span className="text-sm text-slate-700">Public</span>
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg">Cancel</button>
      </div>
    </form>
  );
}

// ── Member management ─────────────────────────────────────────────────────────

const COLLECTION_ROLES = ["owner", "curator"] as const;

const ROLE_BADGE: Record<string, string> = {
  owner:   "bg-amber-100 text-amber-800",
  curator: "bg-teal-100 text-teal-700",
};

function MembersList({
  collectionId,
  canManage,
  teamId,
}: {
  collectionId: string;
  canManage: boolean;
  teamId: string;
}) {
  const { token, user } = useAuth();
  const [members, setMembers] = useState<CollectionMember[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"owner" | "curator">("curator");
  const [adding, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [mems, t] = await Promise.all([
        listCollectionMembers(token, collectionId),
        teamId !== NIL_TEAM_ID ? getTeam(token, teamId) : Promise.resolve(null),
      ]);
      setMembers(mems);
      setTeam(t);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [token, collectionId, teamId]);

  useEffect(() => { load(); }, [load]);

  // Team members not yet in this collection (candidates to add).
  const existingUserIds = new Set(members.map(m => m.user_id));
  const candidates = team?.members.filter(m => !existingUserIds.has(m.user.id) && m.status === "active") ?? [];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !addUserId) return;
    setSaving(true);
    setError(null);
    try {
      const candidate = team?.members.find(m => m.user.id === addUserId);
      const displayName = candidate
        ? (candidate.user.first_name && candidate.user.last_name
            ? `${candidate.user.first_name} ${candidate.user.last_name}`
            : candidate.user.username)
        : undefined;
      await addCollectionMember(token, collectionId, { user_id: addUserId, display_name: displayName, role: addRole });
      setShowAdd(false);
      setAddUserId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    if (!token) return;
    try {
      await updateCollectionMemberRole(token, collectionId, userId, role);
      await load();
    } catch { /* show inline */ }
  }

  async function handleRemove(userId: string, displayName: string | null) {
    if (!token || !confirm(`Remove ${displayName ?? "this member"} from the collection?`)) return;
    try {
      await removeCollectionMember(token, collectionId, userId);
      await load();
    } catch { /* show inline */ }
  }

  if (loading) return <p className="text-xs text-slate-400 py-2">Loading members…</p>;

  return (
    <div className="mt-3 space-y-2">
      {error && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>}

      {members.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {members.map(m => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2 bg-white">
              <span className="flex-1 text-sm text-slate-700 min-w-0 truncate">
                {m.display_name ?? m.user_id.slice(0, 8)}
              </span>
              {canManage && m.user_id !== user?.id ? (
                <select
                  value={m.role}
                  onChange={e => handleRoleChange(m.user_id, e.target.value)}
                  className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-400"
                >
                  {COLLECTION_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[m.role] ?? "bg-slate-100 text-slate-600"}`}>
                  {m.role}
                </span>
              )}
              {canManage && m.user_id !== user?.id && (
                <button
                  type="button"
                  onClick={() => handleRemove(m.user_id, m.display_name)}
                  title="Remove"
                  className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        showAdd ? (
          <form onSubmit={handleAdd} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Team member</label>
              <select value={addUserId} onChange={e => setAddUserId(e.target.value)} className={selectCls} required>
                <option value="">— Select —</option>
                {candidates.map(c => (
                  <option key={c.user.id} value={c.user.id}>
                    {c.user.first_name && c.user.last_name ? `${c.user.first_name} ${c.user.last_name}` : c.user.username} ({c.user.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
              <select value={addRole} onChange={e => setAddRole(e.target.value as "owner" | "curator")} className={selectCls}>
                {COLLECTION_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-1">
              <button type="submit" disabled={adding || !addUserId} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg">
                {adding ? "Adding…" : "Add"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-slate-500 px-2 py-2 rounded-lg hover:bg-slate-50">✕</button>
            </div>
          </form>
        ) : (
          candidates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add member
            </button>
          )
        )
      )}

      {members.length === 0 && !showAdd && (
        <p className="text-xs text-slate-400">No per-collection members. Team-level roles apply.</p>
      )}
    </div>
  );
}

// ── Collection card ───────────────────────────────────────────────────────────

function CollectionCard({
  collection,
  teamName,
  canManage,
  isActive,
  adminTeams,
  onSwitch,
  onChanged,
}: {
  collection: Collection;
  teamName: string;
  canManage: boolean;
  isActive: boolean;
  adminTeams: { id: string; name: string }[];
  onSwitch: () => void;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [editing, setEditing] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!token || !confirm(`Delete "${collection.name}"? This cannot be undone. All objects must be removed first.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCollection(token, collection.id);
      onChanged();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${isActive ? "border-teal-300" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 text-sm">{collection.name}</span>
            {isActive && <span className="text-xs px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">Active</span>}
            {collection.is_public && <span className="text-xs px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">Public</span>}
            <span className="text-xs text-slate-400">{teamName}</span>
          </div>
          {collection.description && <p className="text-xs text-slate-500 mt-0.5">{collection.description}</p>}
          <p className="text-xs text-slate-400 font-mono mt-0.5">{collection.slug}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isActive && (
            <button
              type="button"
              onClick={onSwitch}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors"
            >
              Switch
            </button>
          )}
          {canManage && !editing && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deleting ? "…" : "Delete"}
              </button>
            </>
          )}
        </div>
      </div>

      {deleteError && <p className="text-xs text-red-600 mt-2">{deleteError}</p>}

      {editing && (
        <EditCollectionForm
          collection={collection}
          adminTeams={adminTeams}
          onSave={() => { setEditing(false); onChanged(); }}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Members section */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowMembers(v => !v)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${showMembers ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Collection members
        </button>
        {showMembers && (
          <MembersList
            collectionId={collection.id}
            canManage={canManage}
            teamId={collection.team_id}
          />
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CollectionsSection() {
  const { token, permissions } = useAuth();
  const { collections, activeCollection, teams, adminTeams, canManageCollection, switchCollection, refresh } = useCollection();
  const [showCreate, setShowCreate] = useState(false);
  const adminTeamIds = new Set(adminTeams.map(t => t.id));

  function canManageCard(c: Collection): boolean {
    if (activeCollection?.id === c.id) return canManageCollection;
    if (c.team_id === NIL_TEAM_ID) return permissions.includes("objects:write");
    return adminTeamIds.has(c.team_id);
  }

  // Group collections by team.
  const teamMap = new Map(teams.map(t => [t.id, t.name]));
  teamMap.set(NIL_TEAM_ID, "Default");

  if (!token) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {collections.length} collection{collections.length !== 1 ? "s" : ""} accessible
        </p>
        {teams.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New collection
          </button>
        )}
      </div>

      {collections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-slate-400 text-sm">No collections yet.</p>
          <p className="text-xs text-slate-300 mt-1">Create one above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(c => (
            <CollectionCard
              key={c.id}
              collection={c}
              teamName={teamMap.get(c.team_id) ?? "Unknown team"}
              canManage={canManageCard(c)}
              adminTeams={adminTeams}
              isActive={c.id === activeCollection?.id}
              onSwitch={() => switchCollection(c.id)}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCollectionModal
          teams={adminTeams}
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
