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
  setActiveCollectionId,
  type Collection,
} from "@/lib/collection-api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CartlannRole = "admin" | "curator" | "registrar" | "viewer";

interface CollectionContextValue {
  collections: Collection[];
  activeCollection: Collection | null;
  userRole: CartlannRole | null;
  isLoading: boolean;
  switchCollection: (id: string) => void;
  refresh: () => Promise<void>;
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

function deriveRole(
  token: string,
  teamId: string
): CartlannRole | null {
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

// Nil team_id used for the default (pre-teams) collection.
const NIL_TEAM_ID = "00000000-0000-0000-0000-000000000000";

// ── Context ───────────────────────────────────────────────────────────────────

const CollectionContext = createContext<CollectionContextValue>({
  collections: [],
  activeCollection: null,
  userRole: null,
  isLoading: true,
  switchCollection: () => {},
  refresh: async () => {},
});

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  // On token change (login/logout/SSO), reload collections.
  useEffect(() => {
    if (!token) {
      setCollections([]);
      setActiveId(null);
      setActiveCollectionId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    load(token).then((data) => {
      // Restore from localStorage, or default to first collection.
      const stored = localStorage.getItem(STORAGE_KEY);
      const match = stored ? data.find((c) => c.id === stored) : null;
      const chosen = match ?? data[0] ?? null;
      setActiveId(chosen?.id ?? null);
      setActiveCollectionId(chosen?.id ?? null);
      setIsLoading(false);
    });
  }, [token, load]);

  const switchCollection = useCallback((id: string) => {
    setActiveId(id);
    setActiveCollectionId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const data = await load(token);
    // Keep active collection if still accessible; otherwise fall back to first.
    setActiveId((prev) => {
      const still = prev && data.find((c) => c.id === prev) ? prev : data[0]?.id ?? null;
      setActiveCollectionId(still);
      return still;
    });
  }, [token, load]);

  const activeCollection = collections.find((c) => c.id === activeId) ?? null;

  // Derive the user's Cartlann product role for the active collection's team.
  // Collections with the nil team_id (default/pre-teams) return null — no role enforcement.
  const userRole: CartlannRole | null =
    token && activeCollection && activeCollection.team_id !== NIL_TEAM_ID
      ? deriveRole(token, activeCollection.team_id)
      : null;

  return (
    <CollectionContext.Provider
      value={{ collections, activeCollection, userRole, isLoading, switchCollection, refresh }}
    >
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
