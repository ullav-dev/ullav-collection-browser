# Teams & Multiple Collections — Implementation Plan

## Executive Summary

UUM already has a complete, production-grade team model. The work here is **integration**, not invention. Every Ullav app follows the same canonical pattern:

1. Register as a named **product slug** in UUM
2. Teams enable products; users get per-product roles
3. The JWT carries all team/product membership — apps are stateless
4. App-level resources carry `team_id` as a **soft FK** (UUID, no local FK constraint)
5. The app server validates JWT claims, never queries UUM at request time

This plan locks that pattern in for Cartlann, aligns Obair to it, and defines it as the Ullav platform standard so every future app starts from the same baseline.

---

## Platform Standard (canonical, applies to all apps)

### JWT Claims (already issued by UUM)

```json
{
  "sub": "<user-uuid>",
  "teams": {
    "<team-uuid>": {
      "name": "National Museum of Ireland",
      "role": "owner | leader | member",
      "team_roles": ["Conservator", "Curator"],
      "product_roles": {
        "cartlann":  "admin | curator | registrar | viewer",
        "obair":     "admin | lead | member",
        "clann":     "..."
      },
      "products": ["cartlann", "obair"]
    }
  }
}
```

### App Server Pattern

```
Request arrives with Bearer JWT
  → decode JWT (no UUM call)
  → extract resource's team_id
  → verify teams[team_id] exists in JWT                    → 403 if not
  → verify teams[team_id].product_roles[slug] exists        → 403 if not
  → map product role → permissions                          → 403 if insufficient
  → handle request
```

### Resource Pattern

Every team-scoped resource carries:
```sql
team_id UUID NOT NULL  -- soft FK to UUM teams table; no local FK constraint
```
No joins to a local teams table. No UUM calls at request time.

### Invitation Pattern (already built, reuse across all apps)

- UUM handles the full invite flow (`POST /teams/{id}/invitations`)
- Each app provides an accept page: `/{locale}/auth/team-invite?token={token}`
- The page calls `POST /auth-api/teams/invitations/{token}/accept` then redirects
- Clann-webapp has a complete reference implementation at `src/app/[locale]/auth/team-invite/`

---

## What This Means Per App

| App | Status | Action |
|---|---|---|
| `ullav-user-management` | ✅ Complete | Add "cartlann" to products table; define Cartlann product roles |
| `ullav-collection-server` | ❌ Not started | Add collections table + team_id scoping on all resources |
| `ullav-collection-browser` | ❌ Not started | CollectionContext, switcher, team invite page, team settings UI |
| `awe-server` | ⚠️ Partial | Has team_id on jobs/workflows; needs product role validation |
| `clann-server` | ⚠️ Partial | Has team_id on trees; needs product role validation |
| `clann-webapp` | ✅ Complete | Has full team UI; reference implementation for all other apps |
| `ullav-portal` | ✅ Partial | Seeds teams; handles SSO; needs collection switcher awareness |

---

## Phase 1 — UUM: Register Cartlann as a Product

**Repo:** `ullav-user-management`

### 1.1 Products Table

```sql
-- If not already a products table, add one
INSERT INTO products (slug, name, description) VALUES
  ('cartlann', 'Cartlann', 'Collection management'),
  ('obair',    'Obair',    'Workflow management'),    -- if not already there
  ('comad',    'Comad',    'Digital asset management');
```

### 1.2 Cartlann Product Roles (defined in UUM, validated in collection-server)

| Role | Description | Permissions |
|---|---|---|
| `admin` | Collection administrator | All operations + collection management |
| `curator` | Curator | Objects r/w, research r/w, loans r/w, condition r/w, conservation r/w |
| `registrar` | Registrar | Objects r/w, entries r/w, acquisitions r/w, movements r/w |
| `viewer` | Read-only access | All `*:read` permissions, no writes |

These roles are assigned via `team_member_product_roles` in UUM. Collection-server maps them to its permission strings without calling UUM.

### 1.3 Checklist
- [ ] Confirm `products` table exists and "cartlann" row is present
- [ ] Document the four Cartlann product roles in the platform README
- [ ] Ensure `team_member_product_roles.role` CHECK constraint allows Cartlann values (or is unconstrained TEXT — check current schema)

---

## Phase 2 — Collection Server: Collections + Scoping

**Repo:** `ullav-collection-server` | Branch: `feat/teams-collections`

### 2.1 Migration `006_teams_collections.sql`

```sql
-- Collections: one or more per team
CREATE TABLE collections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id       UUID NOT NULL,          -- soft FK to UUM teams; no local FK
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL,
    description   TEXT,
    is_public     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, slug)
);

CREATE INDEX idx_collections_team ON collections(team_id);

-- Backfill: create one default collection with a nil team_id
-- (replace with real team_id when first team is linked via portal)
INSERT INTO collections (id, team_id, name, slug)
VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',  -- placeholder; updated on first team link
    'Default Collection',
    'default'
);

-- Scope objects to a collection
ALTER TABLE objects         ADD COLUMN collection_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE locations       ADD COLUMN collection_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE parties         ADD COLUMN collection_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE number_schemes  ADD COLUMN collection_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE research_notes  ADD COLUMN collection_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE research_folders ADD COLUMN collection_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE chat_sessions   ADD COLUMN collection_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES collections(id);

-- Drop the defaults after backfill — every new row must supply collection_id explicitly
ALTER TABLE objects          ALTER COLUMN collection_id DROP DEFAULT;
-- ... (same for all tables above)

CREATE INDEX idx_objects_collection ON objects(collection_id);
-- ... indexes for all tables
```

### 2.2 JWT Claim Extraction (new utility in `src/utils/mod.rs`)

```rust
/// Extract the Cartlann product role for the team that owns the given collection.
/// Returns Err(AppError::Forbidden) if the user is not a member of that team
/// or does not have a Cartlann product role.
pub fn cartlann_role(req: &HttpRequest, team_id: Uuid) -> Result<CartlannRole, AppError> {
    let claims = req.extensions().get::<Claims>().cloned().ok_or(AppError::Forbidden)?;
    let team_entry = claims.teams.get(&team_id.to_string()).ok_or(AppError::Forbidden)?;
    let role_str = team_entry.product_roles.get("cartlann").ok_or(AppError::Forbidden)?;
    CartlannRole::from_str(role_str).map_err(|_| AppError::Forbidden)
}
```

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CartlannRole { Admin, Curator, Registrar, Viewer }

impl CartlannRole {
    pub fn can_write(&self) -> bool { !matches!(self, Self::Viewer) }
    pub fn can_manage_collection(&self) -> bool { matches!(self, Self::Admin) }
}
```

### 2.3 Claims Update (expand JWT Claims struct)

```rust
pub struct Claims {
    pub sub: String,
    pub iat: i64, pub exp: i64,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,         // keep for backwards compatibility
    pub teams: HashMap<String, TeamClaim>, // NEW
}

pub struct TeamClaim {
    pub name: String,
    pub role: String,                       // owner | leader | member
    pub product_roles: HashMap<String, String>, // product_slug → role
    pub products: Vec<String>,
}
```

### 2.4 New Handler: `src/handlers/collections.rs`

```
GET    /collections                    — list collections accessible to this user (across all their teams)
POST   /collections                    — create collection (requires team_id in body; caller must be team owner/admin)
GET    /collections/{id}               — get collection detail
PUT    /collections/{id}               — update name/description (admin only)
DELETE /collections/{id}               — delete (admin only; rejects if objects exist)
PATCH  /collections/{id}/team          — link collection to a different team (owner only)
```

### 2.5 All Existing Handlers Updated

Every handler that currently calls `require_permission(&req, "objects:read")` is updated to:

```rust
// 1. Read collection_id from X-Collection-Id header
let collection_id = extract_collection_id(&req)?;
// 2. Look up that collection's team_id
let team_id = db::collections::get_team_id(&state.pool, collection_id).await?;
// 3. Validate JWT teams claim
let role = utils::cartlann_role(&req, team_id)?;
// 4. Check write permission where needed
if mutating && !role.can_write() { return Err(AppError::Forbidden); }
```

`extract_collection_id` reads the `X-Collection-Id` header (set by the frontend on every authenticated request).

### 2.6 Research Notes: Collection-Scoped Sharing

`is_shared = true` notes are now visible to all **collection members** (users whose JWT teams includes the collection's team_id with a Cartlann product role), not all authenticated users. The list query changes:

```sql
WHERE collection_id = $1
  AND (user_id = $2 OR is_shared = TRUE)
```

No more institution-wide leakage across collections.

---

## Phase 3 — Collection Browser: Context + UI

**Repo:** `ullav-collection-browser` | Branch: `feat/teams-collections`

### 3.1 `CollectionContext.tsx`

```typescript
interface Collection {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
}

interface CollectionContextValue {
  collections: Collection[];
  activeCollection: Collection | null;
  setActiveCollection: (id: string) => void;
  isLoading: boolean;
  userRole: "admin" | "curator" | "registrar" | "viewer" | null;
}
```

- On mount: `GET /api/collections` → populate `collections[]`
- Restore `activeCollection` from `localStorage("cartlann_active_collection")`
- Fall back to first collection if stored one is no longer accessible
- `userRole` derived from JWT `teams[activeCollection.team_id].product_roles["cartlann"]`

### 3.2 `apiRequest()` Updated

Every authenticated API call gains `X-Collection-Id: {activeCollection.id}` header automatically. Single change in `collection-api.ts`.

### 3.3 Collection Switcher in Nav

Between the logo and nav links:

```
[ Cartlann ] [ National Museum ▾ ]  Collection  Locations  ...
```

Dropdown groups collections by team name. Shows "+ New Collection" for admins. Shows team name as group header when user is in multiple teams.

### 3.4 Team Management UI (`/settings/team`)

New tab or section in Settings — based on clann-webapp's team UI (direct port, adapted to Cartlann brand):

- Team name and description
- Members list: avatar, name, email, role badge, product role badge
- Invite by email (calls `POST /auth-api/teams/{id}/invitations`)
- Remove member (owner/leader only)
- Change product role (admin only): dropdown Admin / Curator / Registrar / Viewer

### 3.5 Team Invite Accept Page (`/auth/team-invite`)

Port of clann-webapp's `src/app/[locale]/auth/team-invite/page.tsx`:
- Reads `?token=` from URL
- Shows team name + inviter (from UUM token lookup)
- Accept / Decline buttons
- On accept → reload session (JWT will include new team) → redirect to collection switcher

### 3.6 Role-Based UI Gating

Use `userRole` from `CollectionContext` to hide/show destructive actions:
- `viewer` → no Edit/Add/Delete buttons anywhere
- `registrar` → no conservation, loans management
- `curator`, `admin` → full access per Spectrum scope
- `admin` → Collection settings, team management visible

---

## Phase 4 — Awe-Server Alignment

**Repo:** `awe-server`

Awe-server already has `team_id` on jobs and workflows (soft FK, correct pattern). What's missing:

- [ ] Parse `teams` claim from JWT (currently reads flat `permissions[]` only)
- [ ] Register "obair" product roles (`admin`, `lead`, `member`) in UUM
- [ ] Validate `teams[team_id].product_roles["obair"]` on all handlers instead of flat permissions
- [ ] Add `GET /collections`-equivalent: a team-scoped workspace concept if needed

This is a refactor of existing handlers, not new tables.

---

## Phase 5 — Clann-Server Alignment

Minor — already uses `team_id` on family trees and reads JWT teams. Needs:
- [ ] Register "clann" product roles in UUM (`owner`, `member`)
- [ ] Validate `teams[team_id].product_roles["clann"]` instead of the custom `tier` claim

---

## Phase 6 — Portal Awareness

**Repo:** `ullav-portal`

- [ ] After SSO login, read collections from `GET {cartlann}/collections` and pass them in the handoff token so the browser can restore active collection without an extra round-trip
- [ ] Team creation flow: portal already seeds teams; ensure "cartlann" product access is provisioned when a team is created and Cartlann is in their plan

---

## Implementation Order

```
Phase 1  UUM product registration (cartlann slug, product roles)
  ↓
Phase 2  collection-server: collections table + migration + JWT claim expansion
  ↓
Phase 3  collection-browser: CollectionContext + apiRequest header + switcher
  ↓
Phase 3.4-3.5  Team management UI + invite accept page
  ↓
Phase 3.6  Role-based UI gating
  ↓
Phase 4  awe-server alignment (can be parallel to Phase 3)
  ↓
Phase 5  clann-server alignment (can be parallel to Phase 3)
  ↓
Phase 6  Portal awareness
```

---

## Key Constraints

**Do not duplicate team management** in collection-server. All team CRUD stays in UUM. The collection-server only reads `team_id` from resources and validates JWT claims.

**Backwards compatibility:** The default collection with a nil team_id keeps the app working during the transition. The first time a team is linked via the portal, the collection's `team_id` is updated and JWT validation kicks in.

**The `X-Collection-Id` header is required** on all authenticated requests once multi-collection is live. The frontend always sends it; the backend enforces it.

**Invitation flow:** Do not rebuild email invites in Cartlann. UUM already handles it. The only app-level work is the accept page (`/auth/team-invite`), which is a direct port of clann-webapp's page.

---

## Open Questions

1. Does a "viewer" role need to be added to the existing Obair role set, or does Obair not have viewers?
2. Should collections be deletable (with objects), or only archivable?
3. Can a collection be moved between teams (ownership transfer)?
4. When a user is in multiple teams and switches collections, should the active team context (for other apps) follow, or stay independent?
