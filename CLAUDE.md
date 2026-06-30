# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Next.js 16 frontend for the Ullav collection management system (Spectrum 5-aligned). Named **Cartlann** (Irish: treasury/archive). Serves both institutional users (museums, galleries, archaeology) and hobby collectors.

## Tech Stack

- **Next.js 16** (App Router, `[locale]/` prefix, standalone output)
- **React 19**, **TypeScript 5**
- **Tailwind CSS 4** (PostCSS plugin, no config file — all via `@import "tailwindcss"` in globals.css)
- **next-intl** (locales: `en`, `de`, `ga`)
- **Geist** font

## Brand

- Primary: `#0D9488` (teal-600)
- Accent: `#D97706` (amber-600)
- Background: `#F0FDFA` (teal-50)
- Neutral: `#64748B` (slate-500)

Use `text-teal-600`, `bg-teal-600`, `hover:bg-teal-700`, `focus:ring-teal-500` for interactive elements. Never use blue as primary.

## Backend Connections

| Service | Local port | Proxy path |
|---|---|---|
| `ullav-collection-server` | 8084 | `/api/*` |
| `ullav-user-management` | 8081 | `/auth-api/*` |

API rewrites configured in `src/proxy.ts` (Next.js 16's replacement for `middleware.ts`).

## Commands

```bash
npm run dev    # start dev server (port 3000)
npm run build  # production build (TypeScript + lint)
npm run lint   # ESLint
```

## Key Files

- `src/proxy.ts` — API proxy + i18n middleware (Next.js 16 convention: `proxy.ts` not `middleware.ts`)
- `src/i18n/routing.ts` — locale config
- `src/i18n/request.ts` — next-intl server config
- `src/lib/auth-api.ts` — UUM service wrapper (teams, invites, members)
- `src/lib/collection-api.ts` — collection server wrapper (all typed endpoints)
- `src/lib/currencies.ts` — `CURRENCIES` list from `NEXT_PUBLIC_CURRENCIES` env; `DEFAULT_CURRENCY` = first entry
- `src/contexts/AuthContext.tsx` — auth state + idle timeout; session stored in `localStorage` under `cartlann_auth`
- `src/contexts/CollectionContext.tsx` — active collection + role derivation (see below)
- `src/components/Nav.tsx` — header with teal branding + Cartlann logo SVG
- `src/components/TeamSection.tsx` — team member list + invite modal; used inside Settings

## Multi-Tenant Architecture

Every authenticated API request carries `X-Collection-Id` (injected by `setActiveCollectionId` in `collection-api.ts`). The server scopes all resource queries to that collection.

### CollectionContext (`src/contexts/CollectionContext.tsx`)

Loads collections from `/api/collections` on login. Persists the active choice under `cartlann_active_collection` in `localStorage`. Exposes:

```ts
collections: Collection[]
activeCollection: Collection | null
userRole: CartlannRole | null   // 'admin' | 'curator' | 'registrar' | 'viewer'
teams: TeamInfo[]               // derived from JWT teams claim
switchCollection(id): void
refresh(): Promise<void>
```

Role derivation: reads the JWT `teams[teamId].product_roles["cartlann"]` claim for the team that owns the active collection. Collections with the nil team UUID (`00000000-…`) have `userRole = null` (no role enforcement — the legacy default collection).

### Role Hierarchy (server-enforced)

| Role | Reads | Writes objects/parties/locations | Manages collections |
|---|---|---|---|
| `viewer` | ✓ | — | — |
| `registrar` | ✓ | ✓ | — |
| `curator` | ✓ | ✓ | — |
| `admin` | ✓ | ✓ | ✓ |

`admin` is required to create, update, or delete a Collection. Viewers are rejected by `require_collection_write`.

### Default / Legacy Collection

Migration `006_teams_collections.sql` seeded a default collection (`aaaaaaaa-0000-0000-0000-000000000001`) with `team_id = nil UUID`. Pre-team objects are in this collection. The server falls back to `DEFAULT_COLLECTION_ID` when no `X-Collection-Id` is provided.

## Architecture Notes

- All authenticated pages redirect to `/login` when `user` is null (via `useEffect` + `router.replace`)
- Locale layout (`src/app/[locale]/layout.tsx`) wraps everything in `AuthProvider` + `CollectionProvider` + `NextIntlClientProvider`
- `src/app/layout.tsx` is minimal (no font/style) — locale layout handles all styling
- Public portal at `/[locale]/browse` — uses `/api/public/objects` (no auth, no collection header)
- `src/components/FormField.tsx` exports shared `inputCls`, `selectCls`, `ErrorBox`, `SaveButton` — use these everywhere instead of inline classes
- `NEXT_PUBLIC_CURRENCIES` env var (comma-separated, first = default) drives all currency dropdowns via `src/lib/currencies.ts`

## Planned Features

- Phase 2: Condition checking, conservation treatments, loans (requires backend extensions)
- Phase 3: Flexible accession numbering, public portal (requires `is_public` on objects in server)
- Phase 4: Label printing — browser-side PDF (bwip-js + jsPDF) for hobbyists; AWE thermal queue for institutions
- Phase 5: DAM asset linking
- Phase 6: Hobby mode — valuations, templates, quick-add barcode scanner
