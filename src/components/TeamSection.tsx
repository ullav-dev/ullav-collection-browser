"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import {
  getTeam,
  inviteMember,
  removeMember,
  updateMemberProductRole,
  type Team,
  type TeamMember,
} from "@/lib/auth-api";
import UserAvatar from "@/components/UserAvatar";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  owner:  "bg-amber-100  text-amber-800",
  leader: "bg-blue-100   text-blue-800",
  member: "bg-slate-100  text-slate-600",
};

const STATUS_BADGE: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  invited:  "bg-violet-100  text-violet-700",
  inactive: "bg-slate-100   text-slate-500",
};

const CARTLANN_ROLES = ["admin", "curator", "registrar", "viewer"] as const;

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ teamId, onClose, onDone }: { teamId: string; onClose: () => void; onDone: () => void }) {
  const { token } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !token) return;
    setSending(true);
    setError(null);
    try {
      const appUrl = window.location.origin;
      await inviteMember(token, teamId, email.trim(), appUrl, role);
      setSent(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSending(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Invite team member</h2>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              Invitation sent to <strong>{email}</strong>.
            </p>
            <button onClick={onClose} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@museum.ie" className={inputCls} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cartlann role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                {CARTLANN_ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Admin — full access · Curator — objects + research · Registrar — entries + accession · Viewer — read only
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={sending} className="flex-1 border border-slate-300 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={sending || !email.trim()} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {sending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  teamId,
  isOwner,
  currentUserId,
  onChanged,
}: {
  member: TeamMember;
  teamId: string;
  isOwner: boolean;
  currentUserId: string;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [removing, setRemoving] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = member.user.id === currentUserId;
  const canEdit = isOwner && !isSelf && member.role !== "owner";

  async function handleRemove() {
    if (!token || !confirm(`Remove ${member.user.username} from this team?`)) return;
    setRemoving(true);
    try {
      await removeMember(token, teamId, member.user.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  }

  async function handleRoleChange(newRole: string) {
    if (!token) return;
    setUpdatingRole(true);
    try {
      await updateMemberProductRole(token, teamId, member.user.id, newRole);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingRole(false);
    }
  }

  const displayName =
    member.user.first_name && member.user.last_name
      ? `${member.user.first_name} ${member.user.last_name}`
      : member.user.username;

  return (
    <li className="flex items-center gap-3 px-4 py-3 bg-white">
      <UserAvatar user={member.user} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{displayName}</p>
        <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Team role badge */}
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[member.role] ?? ROLE_BADGE.member}`}>
          {member.role}
        </span>
        {/* Status badge */}
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[member.status] ?? STATUS_BADGE.inactive}`}>
          {member.status}
        </span>
        {/* Cartlann product role */}
        {canEdit ? (
          <select
            value={member.product_role ?? ""}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={updatingRole}
            className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-teal-50 text-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-50"
          >
            <option value="">— no role —</option>
            {CARTLANN_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ) : member.product_role ? (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
            {member.product_role}
          </span>
        ) : null}
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          title="Remove from team"
          className="ml-1 shrink-0 p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamSection() {
  const { token, user } = useAuth();
  const { teams } = useCollection();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  // Default to first team
  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const loadTeam = useCallback(async () => {
    if (!token || !selectedTeamId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getTeam(token, selectedTeamId);
      setTeam(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [token, selectedTeamId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <p className="text-slate-400 text-sm">You are not a member of any team yet.</p>
        <p className="text-xs text-slate-400 mt-1">Teams are created and managed via the Ullav Portal.</p>
      </div>
    );
  }

  const isOwner = team?.owner.id === user?.id;

  return (
    <div className="space-y-4">
      {/* Team selector (when user is in multiple teams) */}
      {teams.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTeamId(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                t.id === selectedTeamId
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && <p className="text-sm text-slate-400 py-4 text-center">Loading team…</p>}

      {team && !loading && (
        <>
          {/* Team header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-700">{team.name}</h3>
              {team.description && <p className="text-xs text-slate-400 mt-0.5">{team.description}</p>}
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Invite member
              </button>
            )}
          </div>

          {/* Members list */}
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {team.members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                teamId={team.id}
                isOwner={isOwner}
                currentUserId={user?.id ?? ""}
                onChanged={loadTeam}
              />
            ))}
          </ul>

          <p className="text-xs text-slate-400">
            {team.members.length} member{team.members.length !== 1 ? "s" : ""}.
            Team ownership is managed via the Ullav Portal.
          </p>
        </>
      )}

      {showInvite && team && (
        <InviteModal
          teamId={team.id}
          onClose={() => setShowInvite(false)}
          onDone={() => { setShowInvite(false); loadTeam(); }}
        />
      )}
    </div>
  );
}
