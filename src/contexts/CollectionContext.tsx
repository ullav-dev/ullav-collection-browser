"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listCollections,
  listCollectionMembers,
  setActiveCollectionId,
  type Collection,
  type CollectionMember,
} from "@/lib/collection-api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CartlannRole = "admin" | "curator" | "registrar" | "viewer";
export type CollectionRole = "owner" | "curator";

export interface TeamInfo {
  id: string;
  name: string;
}

interface CollectionContextValue {
  collections: Collection[];
  activeCollection: Collection | null;
  /** Team-level Cartlann product role from JWT (null for legacy nil-team collection). */
  userRole: CartlannRole | null;
  /** Per-collection role from collection_members table (overrides team role for access decisions). */
  collectionRole: CollectionRole | null;
  /** True if the user can create/edit/delete this collection and manage its members. */
  canManageCollection: boolean;
  /** True if the user can write objects/parties/locations in this collection. */
  canWrite: boolean;
  collectionMembers: CollectionMember[];
  teams: TeamInfo[];
  isLoading: boolean;
  switchCollection: (id: string) => void;
  refresh: () => Promise<void>;
  refreshMembers: () => Promise<void>;
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

interface TeamClaim {
  name: string;
  role: string;
  product_roles: Record<string, string>;
  products: string[];
}

function teamsFromToken(token: string): Record<string, TeamClaim> {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload.teams ?? {};
  } catch {
    return {};
  }
}

function userIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function deriveRole(token: string, teamId: string): CartlannRole | null {
  const teams = teamsFromToken(token);
  const team = teams[teamId];
  if (!team) return null;
  const role = team.product_roles?.["cartlann"];
  if (!role) return null;
  return ["admin", "curator", "registrar", "viewer"].includes(role)
    ? (role as CartlannRole)
    : null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "cartlann_active_collection";
const NIL_TEAM_ID = "00000000-0000-0000-0000-000000000000";

// ── Context ───────────────────────────────────────────────────────────────────

const CollectionContext = createContext<CollectionContextValue>({
  collections: [],
  activeCollection: null,
  userRole: null,
  collectionRole: null,
  canManageCollection: false,
  canWrite: false,
  collectionMembers: [],
  teams: [],
  isLoading: true,
  switchCollection: () => {},
  refresh: async () => {},
  refreshMembers: async () => {},
});

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collectionMembers, setCollectionMembers] = useState<CollectionMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (tok: string) => {
    try {
      const data = await listCollections(tok);
      setCollections(data);
      return data;
    } catch {
      setCollections([]);
      return [];
    }
  }, []);

  const loadMembers = useCallback(async (tok: string, collectionId: string) => {
    try {
      const members = await listCollectionMembers(tok, collectionId);
      setCollectionMembers(members);
    } catch {
      setCollectionMembers([]);
    }
  }, []);

  // On token change (login/logout/SSO), reload collections.
  useEffect(() => {
    if (!token) {
      setCollections([]);
      setActiveId(null);
      setCollectionMembers([]);
      setActiveCollectionId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    load(token).then((data) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      const match = stored ? data.find((c) => c.id === stored) : null;
      const chosen = match ?? data[0] ?? null;
      setActiveId(chosen?.id ?? null);
      setActiveCollectionId(chosen?.id ?? null);
      setIsLoading(false);
      if (chosen) loadMembers(token, chosen.id);
    });
  }, [token, load, loadMembers]);

  // Reload members whenever active collection changes.
  useEffect(() => {
    if (token && activeId) loadMembers(token, activeId);
  }, [token, activeId, loadMembers]);

  const switchCollection = useCallback((id: string) => {
    setActiveId(id);
    setActiveCollectionId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const data = await load(token);
    setActiveId((prev) => {
      const still = prev && data.find((c) => c.id === prev) ? prev : data[0]?.id ?? null;
      setActiveCollectionId(still);
      return still;
    });
  }, [token, load]);

  const refreshMembers = useCallback(async () => {
    if (!token || !activeId) return;
    await loadMembers(token, activeId);
  }, [token, activeId, loadMembers]);

  const activeCollection = collections.find((c) => c.id === activeId) ?? null;

  // Team-level Cartlann product role from JWT.
  const userRole: CartlannRole | null =
    token && activeCollection && activeCollection.team_id !== NIL_TEAM_ID
      ? deriveRole(token, activeCollection.team_id)
      : null;

  // Per-collection role from collection_members (the user's own entry).
  const userId = token ? userIdFromToken(token) : null;
  const myMembership = userId
    ? collectionMembers.find((m) => m.user_id === userId) ?? null
    : null;
  const collectionRole: CollectionRole | null =
    (myMembership?.role as CollectionRole) ?? null;

  // Can manage = team admin OR collection owner.
  const canManageCollection =
    userRole === "admin" || collectionRole === "owner";

  // Can write = team non-viewer OR collection owner/curator.
  const canWrite =
    (userRole !== null && userRole !== "viewer") ||
    collectionRole === "owner" ||
    collectionRole === "curator";

  const teams: TeamInfo[] = token
    ? Object.entries(teamsFromToken(token)).map(([id, t]) => ({ id, name: t.name }))
    : [];

  return (
    <CollectionContext.Provider
      value={{
        collections,
        activeCollection,
        userRole,
        collectionRole,
        canManageCollection,
        canWrite,
        collectionMembers,
        teams,
        isLoading,
        switchCollection,
        refresh,
        refreshMembers,
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
