# Research Feature Implementation Plan — Cartlann

## Design Decisions

| Decision | Choice |
|---|---|
| Note↔Object model | Many-to-many join + Research tab on object detail page |
| AI key strategy | Per-user encrypted keys, multi-provider (Anthropic/OpenAI/Google/Mistral/Ollama) |
| Sharing scope | Institution-wide (`is_shared` = visible to all authenticated users) |
| Explore sources | Getty AAT, Europeana, Wikidata (+ Wikipedia as its own tab) |

---

## Branches

- `ullav-collection-server`: `feat/research`
- `ullav-collection-browser`: `feat/research`

---

## Phase 1 — Rust Backend: Schema & API

- [x] **1.1** Migration `migrations/005_research.sql`
  - Tables: `ai_settings`, `research_folders`, `research_notes`, `note_objects`, `chat_sessions`, `chat_messages`
  - Indexes for user_id, folder_id, is_shared, parent_id, object_id, session_id
- [x] **1.2** `Cargo.toml` — add `aes-gcm`, `rand`, `hex`
- [x] **1.3** `src/models/research.rs` — all structs and request types
  - `ResearchFolder`, `CreateFolderRequest`, `RenameFolderRequest`
  - `ResearchNote`, `CreateNoteRequest`, `UpdateNoteRequest`, `SetNoteFolderRequest`
  - `ChatSession`, `CreateSessionRequest`, `ChatMessage`, `AppendMessageRequest`
  - `AiSettings` (never returns encrypted key — `has_key: bool` only), `UpsertAiSettingsRequest`
- [x] **1.4** `src/db/research_folders.rs` — list, create, rename, delete
- [x] **1.5** `src/db/research_notes.rs` — list (with reply_count subquery + object_ids array), get, create, update, delete, list_replies, create_reply, set_folder, set_objects; also chat sessions + messages
- [x] **1.6** Chat session functions in `src/db/research_notes.rs`
- [x] **1.7** Chat message functions in `src/db/research_notes.rs`
- [x] **1.8** `src/db/ai_settings.rs` — get, upsert (AES-256-GCM encrypt), get_decrypted_key, delete
- [x] **1.9** `src/handlers/research_folders.rs` — CRUD handlers
- [x] **1.10** `src/handlers/research_notes.rs` — CRUD + replies + folder assignment + object linking + chat sessions + messages
- [x] **1.11** Chat session/message handlers in `src/handlers/research_notes.rs`
- [x] **1.12** `src/handlers/ai_settings.rs` — get, get_key (server-side only), upsert, delete
- [x] **1.13** `src/main.rs` — register all new routes

### New Routes (Rust)

```
GET    /research-folders
POST   /research-folders
PATCH  /research-folders/{id}
DELETE /research-folders/{id}

GET    /research-notes
POST   /research-notes
GET    /research-notes/{id}
PUT    /research-notes/{id}
DELETE /research-notes/{id}
GET    /research-notes/{id}/replies
POST   /research-notes/{id}/replies
PATCH  /research-notes/{id}/folder
PATCH  /research-notes/{id}/objects

GET    /chat-sessions
POST   /chat-sessions
DELETE /chat-sessions/{id}
GET    /chat-sessions/{id}/messages
POST   /chat-sessions/{id}/messages

GET    /ai-settings
POST   /ai-settings
DELETE /ai-settings
```

### Key Schema Notes

- `research_notes.parent_id` — self-referential FK for reply threading (only 1 level deep)
- `research_notes` list query includes `reply_count` subquery and `object_ids` array from `note_objects`
- `ai_settings.encrypted_key` — stored as `hex(nonce):hex(ciphertext)` (AES-256-GCM)
- Auth: all research routes require valid JWT; reuse `objects:read` permission check for v1 (no new permissions needed in `ullav-user-management`)
- Institution-wide sharing: `is_shared=true` notes visible to ANY authenticated user (no tenant scope in v1)

### Environment Variable (Rust)

```
ENCRYPTION_KEY=<64 hex chars = 32 bytes>
```

---

## Phase 2 — Frontend: Packages & Proxy

- [x] **2.1** Install npm packages
  ```bash
  npm install ai @ai-sdk/react @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google @ai-sdk/mistral
  npm install react-markdown remark-gfm
  ```
- [x] **2.2** Fix `src/proxy.ts` — carve-outs for local Next.js API route handlers before the generic `/api/*` catch-all:
  - `/api/ai/`
  - `/api/europeana/`
  - `/api/getty/`
  - `/api/wikidata/`
  - `/api/wikipedia/`

  > **Critical:** The current proxy forwards ALL `/api/*` to the Rust server. Without these carve-outs, Next.js route handlers for AI, Wikipedia, and external search proxies are silently swallowed.

- [x] **2.3** New Next.js API route handlers (`src/app/api/`)

  | Route | Purpose |
  |---|---|
  | `api/ai/chat/route.ts` | Streaming AI — fetches decrypted key from Rust, calls provider SDK, streams |
  | `api/ai/settings/route.ts` | Thin proxy to Rust `/ai-settings` (passes bearer token) |
  | `api/wikipedia/search/route.ts` | Wikipedia REST proxy (locale-aware, avoids CORS) |
  | `api/europeana/search/route.ts` | Europeana API proxy (hides `EUROPEANA_API_KEY`) |
  | `api/getty/search/route.ts` | Getty AAT SPARQL proxy |
  | `api/wikidata/search/route.ts` | Wikidata MediaWiki API proxy |

  **`api/ai/chat/route.ts` flow:**
  1. Extract bearer token from Authorization header
  2. Fetch `/ai-settings` from collection-server → get provider, model, decrypted key, base_url
  3. Instantiate AI SDK provider (Anthropic/OpenAI/Google/Mistral; Ollama via OpenAI with custom baseURL)
  4. Build system prompt + inject context (object details, collection context, note body)
  5. `streamText()` → `result.toDataStreamResponse()`
  6. `export const runtime = "nodejs"` (not edge — needs Node.js crypto)

- [x] **2.4** Update `src/lib/collection-api.ts` — add typed functions for all new Rust endpoints
  - Research folders: `listFolders`, `createFolder`, `renameFolder`, `deleteFolder`
  - Research notes: `listNotes`, `createNote`, `getNote`, `updateNote`, `deleteNote`, `listNoteReplies`, `createNoteReply`, `setNoteFolder`, `setNoteObjects`
  - Chat: `listChatSessions`, `createChatSession`, `deleteChatSession`, `listSessionMessages`, `appendSessionMessage`
  - AI settings: `getAiSettings`, `upsertAiSettings`, `deleteAiSettings`

- [x] **2.5** Types added directly to `src/lib/collection-api.ts` (no separate types.ts needed)
  - `ResearchFolder`, `ResearchNote`, `ChatSession`, `ChatMessage`, `AiSettings`

### Environment Variable (Frontend)

```
EUROPEANA_API_KEY=<from api.europeana.eu>
```

---

## Phase 3 — Research Page & Notes UI

- [x] **3.1** `src/app/[locale]/research/page.tsx` — server component, passes searchParams as props to `<ResearchPage />`
- [x] **3.2** `src/components/ResearchPage.tsx` — three-panel layout

  ```
  ┌─────────────────────────────────────────────────────┐
  │  Nav header                                         │
  ├────────────┬─────────────────────┬──────────────────┤
  │ Folder     │ Notes list          │ Note editor  OR  │
  │ sidebar    │ (filtered by folder)│ AI/Wiki/Explore  │
  │            │                     │ panel            │
  │ 📁 All     │  📄 Note 1          │                  │
  │ 📁 Unfiled │  📄 Note 2          │  [ Tabs ]        │
  │ 📁 Shared  │  ...                │                  │
  │ 📁 My Fldr │                     │                  │
  │ + New      │  + New Note         │                  │
  └────────────┴─────────────────────┴──────────────────┘
  ```

  **Right panel tabs:** Notes editor | AI Assistant | Wikipedia | Explore

  **Folder sidebar virtual folders:**
  - All (own + shared)
  - Unfiled (own, `folder_id = null`)
  - Shared by Me (own, `is_shared = true`)
  - Shared by Others (`is_shared = true`, other users)
  - Real folders (user's own)
  - "+ New Folder" inline

  **Auto-refresh:** Every 60 seconds when "Shared by Others" is active folder

  **URL param integration:**
  - `?objectId=` → auto-fetch object, inject into AI context, show breadcrumb "← Object Title"
  - `?noteId=` → auto-select and open that note
  - `?new=1` → auto-open new note form (linked to objectId if present)

- [x] **3.3** `src/components/MarkdownEditor.tsx` — textarea + live preview toggle
  - Toolbar: bold, italic, link, image (DAM picker), code block, table
  - Preview rendered with `react-markdown` + `remark-gfm`
  - No WYSIWYG library (keeps deps minimal)

- [x] **3.4** `src/components/NoteThread.tsx` — replies for shared notes only
  - Shows parent note + replies below
  - Reply input at bottom, renders body as Markdown
  - Only visible/usable on `is_shared = true` notes

- [x] **3.5** Object linking UI inside note editor (ObjectLinkPanel — debounced search + chip list)
  - "Linked Objects" chip list in note editor footer
  - "+" opens debounced object search (`GET /api/objects?q=`) to add links
  - Remove link per chip

---

## Phase 4 — AI Chat

- [x] **4.1** `src/components/AiChat.tsx` — full AI chat panel

  **System prompt (collection/provenance specialist):**
  > You are a specialist assistant for collection management, art history, provenance research, and cultural heritage documentation. Expertise in: provenance research and WWII-era due diligence, art historical analysis and attribution, museum cataloguing (Spectrum, LIDO, Dublin Core, Getty standards), materials and conservation terminology, auction records and exhibition histories, cultural property law and restitution, authority files (Getty AAT/ULAN/TGN, VIAF, LC subject headings), key databases (Art Loss Register, Interpol PSYCHE, RKD, BnF). Be concise and cite sources. Flag ethical and legal considerations around provenance gaps.

  **Context injection (in request body to `/api/ai/chat`):**
  1. Object context — title, accession number, type, maker, dates, materials, description, location, status
  2. Collection context — up to 30 recent objects (title, type, date, maker)
  3. Note context — title + body of selected note ("Dig Deeper" feature)

  **Prompt templates (6 categories):**
  - Provenance — ownership history, WWII gap research
  - Attribution — maker research, dating assessment
  - Materials — conservation considerations, technique identification
  - Valuation — comparable auction results, insurance significance
  - Documentation — catalogue entry drafting, AAT term suggestions
  - Research strategy — where to look, which archives to target

  Plus object-specific templates when `?objectId=` is set.

  **Session management:**
  - Auto-create session on first message (title = first user message, truncated 60 chars)
  - Persist messages via `POST /api/chat-sessions/{id}/messages`
  - Session history panel with delete

  **Save features:**
  - Save single AI response as note
  - Save entire conversation as note (formatted as Q&A markdown)

---

## Phase 5 — Wikipedia Search

- [x] **5.1** `src/components/WikipediaSearch.tsx` — near-direct port, Cartlann colours, uses `/api/wikipedia/search` proxy, pre-populated from current object title
  - Debounced search → `api/wikipedia/search` proxy
  - Locale-aware (en/de/ga → Wikipedia language)
  - Results with thumbnails and excerpts
  - Article summary view
  - "Save as Note" — pre-fills title, Wikipedia URL as description, extract + markdown citation as body
  - If `?objectId=` is set, pre-populates search with object title

---

## Phase 6 — Explore Tab

- [x] **6.1** `src/components/GettyAATSearch.tsx`
  - Search Getty Art & Architecture Thesaurus for controlled vocabulary
  - **API:** Getty SPARQL endpoint (`http://vocab.getty.edu/sparql`) via `api/getty/search` proxy
  - Returns: term ID, prefLabel, definition, broader terms, related terms
  - "Save as Note" — terminology note with term hierarchy and scope note
  - Use case: look up standard terms for object types, materials, techniques

- [x] **6.2** `src/components/EuropeanaSearch.tsx`
  - Search 50M+ European cultural heritage records
  - **API:** `https://api.europeana.eu/record/v2/search.json` via `api/europeana/search` proxy (hides API key)
  - Filters: keyword, date range, media type, country, rights statement
  - Results: thumbnail, title, institution, date, type
  - "Save as Note" — metadata + Europeana URL

- [x] **6.3** `src/components/WikidataSearch.tsx`
  - Search Wikidata for artists, makers, places, historical events, institutions
  - **API:** `https://www.wikidata.org/w/api.php?action=wbsearchentities` via `api/wikidata/search` proxy
  - Entity detail view: birth/death, nationality, occupation, notable works, authority IDs (VIAF, ULAN, RKD)
  - "Save as Note" — structured artist/maker biography note

- [x] **6.4** Explore dropdown menu in `ResearchPage.tsx`
  - Toolbar "Explore" button → dropdown: Getty AAT | Europeana | Wikidata
  - Selecting switches right panel to the appropriate component

---

## Phase 7 — Object Detail Integration

- [x] **7.1** Add "Research" as 7th tab in `src/app/[locale]/objects/[id]/page.tsx`

  Tab content:
  - **Research with AI** button → `/research?objectId={id}`
  - **Linked Notes** — list of notes linked to this object, grouped by folder
    - Each note: title, description, updated_at, shared badge, folder name
    - Click → `/research?noteId={id}`
    - **New Note** → `/research?objectId={id}&new=1`
    - **Link existing note** → search overlay

- [x] **7.2** Research icon on object list rows (`objects/page.tsx`) — sparkle icon, hidden on small screens, stops row-click propagation

---

## Phase 8 — AI Settings UI

- [x] **8.1** "AI Assistant" section in `src/app/[locale]/settings/page.tsx`
  - Provider dropdown: Anthropic / OpenAI / Google / Mistral / Ollama
  - Model dropdown (options per provider)
  - API Key (password input; shows "key saved" when one exists)
  - Base URL (Ollama only)
  - Test button (one test message to verify)
  - Save / Clear

  **Encryption flow:**
  1. User submits key → `POST /api/ai/settings` → Next.js proxy → Rust `POST /ai-settings`
  2. Rust: AES-256-GCM encrypt with `ENCRYPTION_KEY`, store `hex(nonce):hex(ciphertext)`
  3. On AI chat: Next.js route handler calls Rust → decrypts key → uses it server-side only
  4. Decrypted key never reaches the browser

---

## Phase 9 — i18n

- [x] **9.1** Full research namespace added to all three message files (en/de/ga) + Nav.tsx wired to useTranslations("nav") for all links

  Key namespaces: `nav.research`, `research.*`, `research.settings.*`, `research.explore.*`

---

## Phase 10 — Navigation Polish

- [x] **10.1** Add "Research" link to `src/components/Nav.tsx` (authenticated nav, between Acquisitions and user dropdown)
- [x] **10.2** Current-object header bar across full Research page width; localStorage persistence of last viewed object; "Dig Deeper" button wires note → AI tab
- [x] **10.3** Mobile responsiveness — sidebar hidden on mobile; horizontal folder chips replace it; notes list and right panel toggle via mobileView state; back button on panel; tab labels shortened; auto-switch to panel on note select/edit

---

## Implementation Order

```
Phase 10 env vars  (config — unblocks everything)
     ↓
Phase 1  (Rust backend — curl-testable before any frontend work)
     ↓
Phase 2  (packages + proxy + API client — unblocks all frontend phases)
     ↓
Phase 8  (AI settings — needed before Phase 4 can be tested end-to-end)
Phase 3  (Notes UI — highest UX value, the "very important" piece)
Phase 4  (AI Chat)
Phase 5  (Wikipedia — cleanest port, lowest risk)
Phase 9  (i18n — do progressively alongside Phases 3–7)
Phase 6  (Explore — Getty, Europeana, Wikidata)
Phase 7  (Object detail integration — ties everything together)
Phase 10 (Nav link — 30 seconds, do it alongside Phase 3)
```

---

## Cross-Cutting Concerns

**Proxy collision** — `/api/*` in `proxy.ts` swallows all paths including local Next.js route handlers. Phase 2 fixes this with explicit carve-outs before the catch-all. Must be done before any AI or external search features can work.

**Permissions** — For v1, all research endpoints require a valid JWT and reuse `objects:read` permission check. No new permissions registered in `ullav-user-management`. Revisit if role-gating (e.g. only `curator` can share notes) is needed later.

**Note scoping** — Notes are scoped by `user_id`. Institution-wide sharing means `is_shared=true` notes are visible to ANY authenticated user. If multi-tenancy is introduced, add `tenant_id` column and update list query.

**SurrealDB→PostgreSQL** — clann note shapes (`id: "research_note:<ulid>"`, `trees: string[]`) are SurrealDB-specific. In Cartlann: IDs are UUIDs, tree relationship becomes the `note_objects` join table. Frontend types are adapted, not copied.

**Streaming runtime** — `export const runtime = "nodejs"` required on the AI chat route handler (not edge runtime — needs Node.js crypto for provider SDKs).

**Reply threading** — Only 1 level deep. Replies are `research_notes` rows with `parent_id` set. The list endpoint excludes replies (`WHERE parent_id IS NULL`) and includes a `reply_count` subquery. Replies only allowed on `is_shared = true` notes.
